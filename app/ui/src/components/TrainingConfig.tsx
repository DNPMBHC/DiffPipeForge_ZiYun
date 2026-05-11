import React from 'react';
import { GlassCard } from './ui/GlassCard';
import { GlassInput } from './ui/GlassInput';
import { GlassSelect } from './ui/GlassSelect';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { HelpIcon } from './ui/HelpIcon';
import { cn } from '@/lib/utils';

export interface TrainingConfigProps {
    data: any;
    modelType?: string;
    onChange: (data: any) => void;
    validationEnabled?: boolean;
}

export function TrainingConfig({ data, modelType, onChange, validationEnabled = true }: TrainingConfigProps) {
    const { t } = useTranslation();

    const isVideoModel = ['hunyuan_video', 'ltx_video', 'wan21', 'wan22', 'hunyuan_video_15', 'cosmos'].includes(modelType || '');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        onChange({ ...data, [e.target.name]: e.target.value });
    };

    return (
        <div className="space-y-6">
            <GlassCard className="p-6">
                <div className="mb-6">
                    <h3 className="text-2xl font-bold">{t('training.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('training.desc')}</p>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <GlassInput label={t('training.output_name')} helpText={t('help.output_name')} name="output_folder_name" value={data.output_folder_name ?? 'mylora'} onChange={handleChange} />
                    <GlassInput label={t('training.epochs')} helpText={t('help.epochs')} name="epochs" type="number" value={data.epochs ?? 50} onChange={handleChange} />
                    <GlassInput label={t('training.batch_size')} helpText={t('help.micro_batch_size_per_gpu')} name="micro_batch_size_per_gpu" type="number" value={data.micro_batch_size_per_gpu ?? 1} onChange={handleChange} />
                    <GlassInput label={t('training.image_micro_batch_size_per_gpu')} helpText={t('help.image_micro_batch_size_per_gpu')} name="image_micro_batch_size_per_gpu" type="number" value={data.image_micro_batch_size_per_gpu ?? ''} onChange={handleChange} placeholder={data.micro_batch_size_per_gpu ?? 1} />

                    <GlassInput label={t('training.grad_accumulation')} helpText={t('help.gradient_accumulation_steps')} name="gradient_accumulation_steps" type="number" value={data.gradient_accumulation_steps ?? 3} onChange={handleChange} />
                    <GlassInput label={t('training.warmup_steps')} helpText={t('help.warmup_steps')} name="warmup_steps" type="number" min="0" value={data.warmup_steps ?? 500} onChange={handleChange} />

                    <GlassSelect
                        label={t('training.lr_scheduler')}
                        helpText={t('help.lr_scheduler')}
                        name="lr_scheduler"
                        value={data.lr_scheduler ?? 'linear'}
                        onChange={handleChange}
                        options={[
                            { label: 'Constant', value: 'constant' },
                            { label: 'Linear', value: 'linear' },
                            { label: 'Cosine', value: 'cosine' }
                        ]}
                    />

                    <GlassInput label={t('training.grad_clipping')} helpText={t('help.grad_clipping')} name="gradient_clipping" type="number" step="0.1" value={data.gradient_clipping ?? 1.0} onChange={handleChange} />

                    <GlassSelect
                        label={t('training.save_dtype')}
                        helpText={t('help.save_dtype')}
                        name="save_dtype"
                        value={data.save_dtype ?? 'bfloat16'}
                        onChange={handleChange}
                        options={[{ label: 'bfloat16', value: 'bfloat16' }, { label: 'float16', value: 'float16' }, { label: 'float32', value: 'float32' }]}
                    />

                    <GlassSelect
                        label={t('training.partition_method')}
                        helpText={t('help.partition_method')}
                        name="partition_method"
                        value={data.partition_method ?? 'parameters'}
                        onChange={handleChange}
                        options={[{ label: 'parameters', value: 'parameters' }, { label: 'uniform', value: 'uniform' }, { label: 'memory', value: 'memory' }]}
                    />

                    <GlassSelect
                        label={t('training.activation_checkpointing')}
                        helpText={t('help.activation_checkpointing')}
                        name="activation_checkpointing"
                        value={data.activation_checkpointing ?? 'true'}
                        onChange={handleChange}
                        options={[
                            { label: t('dataset.enabled'), value: 'true' },
                            { label: t('dataset.disabled'), value: 'false' },
                            { label: t('training.activation_checkpointing_unsloth'), value: 'unsloth' }
                        ]}
                    />

                    <GlassInput label={t('training.pipeline_stages')} helpText={t('help.pipeline_stages')} name="pipeline_stages" type="number" value={data.pipeline_stages ?? 1} onChange={handleChange} />
                    <GlassInput label={t('training.blocks_to_swap')} helpText={t('help.blocks_to_swap')} name="blocks_to_swap" type="number" min={0} value={data.blocks_to_swap ?? 0} onChange={handleChange} disabled={!!data.layer_offloading} />
                    <div className="md:col-span-3 rounded-xl border border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-md p-4 shadow-sm space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    启用分层加载
                                </span>
                                <HelpIcon text={t('help.layer_offloading')} />
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={!!data.layer_offloading}
                                onClick={() => onChange({ ...data, layer_offloading: !data.layer_offloading })}
                                className={cn(
                                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                    data.layer_offloading ? "bg-primary" : "bg-gray-300 dark:bg-gray-700"
                                )}
                            >
                                <span
                                    className={cn(
                                        "pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
                                        data.layer_offloading ? "translate-x-5" : "translate-x-0.5"
                                    )}
                                />
                            </button>
                        </div>
                        <div className="grid gap-5 md:grid-cols-2">
                            <div className={cn("space-y-2 transition-opacity", !data.layer_offloading && "opacity-50")}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <label htmlFor="layer_offloading_percent" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            分层加载比例 (%)
                                        </label>
                                        <HelpIcon text={t('help.layer_offloading_percent')} />
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground tabular-nums">{data.layer_offloading_percent ?? 50}%</span>
                                </div>
                                <input
                                    id="layer_offloading_percent"
                                    name="layer_offloading_percent"
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={data.layer_offloading_percent ?? 50}
                                    onChange={handleChange}
                                    disabled={!data.layer_offloading}
                                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-gray-800 accent-primary disabled:cursor-not-allowed"
                                />
                            </div>
                            <div className={cn("space-y-2 transition-opacity", !data.layer_offloading && "opacity-50")}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <label htmlFor="layer_offloading_text_encoder_percent" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            文本编码器卸载比例 (%)
                                        </label>
                                        <HelpIcon text={t('help.layer_offloading_text_encoder_percent')} />
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground tabular-nums">{data.layer_offloading_text_encoder_percent ?? 100}%</span>
                                </div>
                                <input
                                    id="layer_offloading_text_encoder_percent"
                                    name="layer_offloading_text_encoder_percent"
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={data.layer_offloading_text_encoder_percent ?? 100}
                                    onChange={handleChange}
                                    disabled={!data.layer_offloading}
                                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-gray-800 accent-primary disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>
                    <GlassInput label={t('training.caching_batch_size')} helpText={t('help.caching_batch_size')} name="caching_batch_size" type="number" value={data.caching_batch_size ?? 1} onChange={handleChange} />

                    {isVideoModel && (
                        <GlassSelect
                            label={t('training.video_clip_mode')}
                            helpText={t('help.video_clip_mode')}
                            name="video_clip_mode"
                            value={data.video_clip_mode ?? 'none'}
                            onChange={handleChange}
                            options={[
                                { label: 'None', value: 'none' },
                                { label: 'Single Beginning', value: 'single_beginning' },
                                { label: 'Single Middle', value: 'single_middle' },
                                { label: 'Multiple Overlapping', value: 'multiple_overlapping' }
                            ]}
                        />
                    )}

                    <GlassInput label={t('training.steps_per_print')} helpText={t('help.steps_per_print')} name="steps_per_print" type="number" value={data.steps_per_print ?? 1} onChange={handleChange} />
                    <GlassInput label={t('training.save_every_n_epochs')} helpText={t('help.save_every_n_epochs')} name="save_every_n_epochs" type="number" value={data.save_every_n_epochs ?? 1} onChange={handleChange} />
                    <GlassInput label={t('training.checkpoint_every_n_minutes')} helpText={t('help.checkpoint_every_n_minutes')} name="checkpoint_every_n_minutes" type="number" value={data.checkpoint_every_n_minutes ?? 120} onChange={handleChange} />

                    <div className="md:col-span-3 border-t border-white/10 my-4 pt-4">
                        <h4 className="text-lg font-semibold mb-4 text-muted-foreground">{t('training.eval_settings')}</h4>

                        {!validationEnabled ? (
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3 text-yellow-500/80">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm">{t('training.validation_disabled_hint')}</span>
                            </div>
                        ) : (
                            <div className="grid gap-6 md:grid-cols-3">
                                <GlassInput label={t('training.eval_every_n_epochs')} helpText={t('help.eval_every_n_epochs')} name="eval_every_n_epochs" type="number" value={data.eval_every_n_epochs ?? 1} onChange={handleChange} />
                                <GlassInput label={t('advanced_training.eval_every_n_steps')} helpText={t('help.eval_every_n_steps')} name="eval_every_n_steps" type="number" value={data.eval_every_n_steps ?? 0} onChange={handleChange} />
                                <GlassInput label={t('training.eval_batch_size')} helpText={t('help.eval_batch_size')} name="eval_micro_batch_size_per_gpu" type="number" value={data.eval_micro_batch_size_per_gpu ?? 1} onChange={handleChange} />
                                <GlassInput label={t('training.image_eval_micro_batch_size_per_gpu')} helpText={t('help.image_eval_micro_batch_size_per_gpu')} name="image_eval_micro_batch_size_per_gpu" type="number" value={data.image_eval_micro_batch_size_per_gpu ?? ''} onChange={handleChange} placeholder={data.eval_micro_batch_size_per_gpu ?? 1} />
                                <GlassInput label={t('training.eval_grad_accumulation')} helpText={t('help.eval_gradient_accumulation_steps')} name="eval_gradient_accumulation_steps" type="number" value={data.eval_gradient_accumulation_steps ?? 1} onChange={handleChange} />

                                <div className="flex items-center gap-6 mt-8">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" name="eval_before_first_step" id="eval_before_first_step" className="w-4 h-4" checked={data.eval_before_first_step !== false} onChange={(e) => onChange({ ...data, eval_before_first_step: e.target.checked })} />
                                        <label htmlFor="eval_before_first_step" className="text-sm flex items-center gap-1 cursor-pointer">
                                            {t('training.eval_before_first_step')}
                                            <HelpIcon text={t('help.eval_before_first_step')} />
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" name="disable_block_swap_for_eval" id="disable_block_swap_for_eval" className="w-4 h-4" checked={!!data.disable_block_swap_for_eval} onChange={(e) => onChange({ ...data, disable_block_swap_for_eval: e.target.checked })} />
                                        <label htmlFor="disable_block_swap_for_eval" className="text-sm flex items-center gap-1 cursor-pointer">
                                            {t('training.disable_block_swap_for_eval')}
                                            <HelpIcon text={t('help.disable_block_swap_for_eval')} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
