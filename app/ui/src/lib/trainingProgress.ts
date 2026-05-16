import { ipc } from '@/lib/ipc';
import { parse } from 'smol-toml';

export interface TrainingProgressEstimate {
  totalSteps: number | null;
  source: 'max_steps' | 'dataset_estimate' | 'unknown';
  sampleCount: number | null;
  imageCount: number | null;
  videoCount: number | null;
  weightedSampleCount: number | null;
  datasetPath: string | null;
  reason?: string;
}

export interface TrainingProgressSnapshot {
  currentStep: number | null;
  totalSteps: number | null;
  percent: number | null;
  remainingSteps: number | null;
  etaSeconds: number | null;
}

interface DatasetEntry {
  path: string;
  repeats: number;
}

const toPositiveNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const isAbsolutePath = (value: string) => /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\\\');

const normalizeProjectPath = (path: string) => path.replace(/\\/g, '/');

export const resolveConfigPath = (projectPath: string, pathValue: string) => {
  if (!pathValue) return '';
  if (isAbsolutePath(pathValue)) return pathValue;
  return `${normalizeProjectPath(projectPath)}/${pathValue}`.replace(/\/+/g, '/');
};

const asArray = (value: unknown): any[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const pushPathValue = (entries: DatasetEntry[], value: unknown, repeats: number) => {
  if (typeof value === 'string' && value.trim()) {
    entries.push({ path: value.trim(), repeats });
  } else if (Array.isArray(value)) {
    value.forEach(item => pushPathValue(entries, item, repeats));
  }
};

const countMediaFiles = async (dirPath: string) => {
  try {
    const res = await ipc.invoke('list-media', { dirPath, limit: 1 });
    return {
      total: toPositiveNumber(res?.total, 0),
      imageTotal: toPositiveNumber(res?.imageTotal, 0),
      videoTotal: toPositiveNumber(res?.videoTotal, 0),
    };
  } catch {
    const res = await ipc.invoke('list-images', { dirPath, limit: 1 });
    const total = toPositiveNumber(res?.total, 0);
    return { total, imageTotal: total, videoTotal: 0 };
  }
};

export const extractDatasetEntries = (datasetConfig: any): DatasetEntry[] => {
  const entries: DatasetEntry[] = [];

  asArray(datasetConfig.directory).forEach((dir: any) => {
    const repeats = toPositiveNumber(dir?.num_repeats, 1);
    pushPathValue(entries, dir?.path, repeats);
  });

  asArray(datasetConfig.datasets).forEach((dataset: any) => {
    const repeats = toPositiveNumber(dataset?.num_repeats, 1);
    pushPathValue(entries, dataset?.input_path, repeats);
  });

  if (entries.length === 0) {
    const repeats = toPositiveNumber(datasetConfig.num_repeats, 1);
    pushPathValue(entries, datasetConfig.input_path, repeats);
  }

  return entries;
};

export async function estimateTrainingProgress(projectPath: string, trainConfig: any, numGpus = 1): Promise<TrainingProgressEstimate> {
  const maxSteps = toPositiveNumber(trainConfig.max_steps, 0);
  if (maxSteps > 0) {
    return {
      totalSteps: Math.floor(maxSteps),
      source: 'max_steps',
      sampleCount: null,
      imageCount: null,
      videoCount: null,
      weightedSampleCount: null,
      datasetPath: typeof trainConfig.dataset === 'string' ? resolveConfigPath(projectPath, trainConfig.dataset) : null,
    };
  }

  if (typeof trainConfig.dataset !== 'string' || !trainConfig.dataset.trim()) {
    return { totalSteps: null, source: 'unknown', sampleCount: null, imageCount: null, videoCount: null, weightedSampleCount: null, datasetPath: null, reason: 'missing_dataset_config' };
  }

  const datasetPath = resolveConfigPath(projectPath, trainConfig.dataset);
  const datasetContent = await ipc.invoke('read-file', datasetPath);
  if (!datasetContent) {
    return { totalSteps: null, source: 'unknown', sampleCount: null, imageCount: null, videoCount: null, weightedSampleCount: null, datasetPath, reason: 'dataset_config_unreadable' };
  }

  const datasetConfig = parse(datasetContent) as any;
  const entries = extractDatasetEntries(datasetConfig);
  if (entries.length === 0) {
    return { totalSteps: null, source: 'unknown', sampleCount: null, imageCount: null, videoCount: null, weightedSampleCount: null, datasetPath, reason: 'dataset_paths_missing' };
  }

  let sampleCount = 0;
  let imageCount = 0;
  let videoCount = 0;
  let weightedSampleCount = 0;
  for (const entry of entries) {
    const resolvedPath = resolveConfigPath(projectPath, entry.path);
    try {
      const media = await countMediaFiles(resolvedPath);
      const total = media.total;
      sampleCount += total;
      imageCount += media.imageTotal;
      videoCount += media.videoTotal;
      weightedSampleCount += total * entry.repeats;
    } catch (e) {
      console.warn('[TrainingProgress] Failed to count dataset path:', resolvedPath, e);
    }
  }

  if (weightedSampleCount <= 0) {
    return { totalSteps: null, source: 'unknown', sampleCount, imageCount, videoCount, weightedSampleCount, datasetPath, reason: 'dataset_empty_or_unsupported' };
  }

  const epochs = toPositiveNumber(trainConfig.epochs, 1);
  const microBatch = toPositiveNumber(trainConfig.micro_batch_size_per_gpu, 1);
  const gradAccum = toPositiveNumber(trainConfig.gradient_accumulation_steps, 1);
  const gpuCount = toPositiveNumber(numGpus, 1);
  const effectiveBatch = Math.max(1, microBatch * gradAccum * gpuCount);
  const stepsPerEpoch = Math.ceil(weightedSampleCount / effectiveBatch);

  return {
    totalSteps: Math.max(1, stepsPerEpoch * epochs),
    source: 'dataset_estimate',
    sampleCount,
    imageCount,
    videoCount,
    weightedSampleCount,
    datasetPath,
  };
}

export const parseCurrentStepFromLogs = (logs: string[]): number | null => {
  for (let i = logs.length - 1; i >= 0; i--) {
    const match = logs[i].match(/(?:^|\s)steps:\s*(\d+)/i);
    if (match) return Number(match[1]);
  }
  return null;
};

export const buildProgressSnapshot = (logs: string[], totalSteps: number | null, iterTime?: number | null): TrainingProgressSnapshot => {
  const currentStep = parseCurrentStepFromLogs(logs);
  const normalizedTotal = totalSteps && totalSteps > 0 ? totalSteps : null;
  const remainingSteps = currentStep !== null && normalizedTotal !== null ? Math.max(0, normalizedTotal - currentStep) : null;
  const etaSeconds = remainingSteps !== null && iterTime && iterTime > 0 ? remainingSteps * iterTime : null;
  const percent = currentStep !== null && normalizedTotal !== null ? Math.min(100, Math.max(0, (currentStep / normalizedTotal) * 100)) : null;

  return { currentStep, totalSteps: normalizedTotal, percent, remainingSteps, etaSeconds };
};

export const formatDuration = (seconds: number | null) => {
  if (seconds === null || !Number.isFinite(seconds)) return '--';
  const rounded = Math.max(0, Math.round(seconds));
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};
