import { ipc } from '@/lib/ipc';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, Play, StopCircle, Terminal, ExternalLink, FlipHorizontal2, Images, Video } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { GlassInput } from '../ui/GlassInput';
import { GlassSelect } from '../ui/GlassSelect';
import { useGlassToast } from '../ui/GlassToast';
import { cn } from '@/lib/utils';
import { ImagePreviewGrid } from './ImagePreviewGrid';

const SCRIPT_NAME = 'mirror_flip.py';

type FlipMode = 'horizontal' | 'vertical' | 'both';
type MediaType = 'all' | 'image' | 'video';

export function MirrorFlipTool() {
    const { t } = useTranslation();
    const { showToast } = useGlassToast();
    const [inputDir, setInputDir] = useState('');
    const [mode, setMode] = useState<FlipMode>('horizontal');
    const [mediaType, setMediaType] = useState<MediaType>('all');
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const sync = async () => {
            const commonSettings = await ipc.invoke('get-tool-settings', 'common_toolbox_settings');
            if (commonSettings.imageDir) setInputDir(commonSettings.imageDir);

            const toolSettings = await ipc.invoke('get-tool-settings', 'mirror_flip');
            if (toolSettings) {
                if (toolSettings.mode) setMode(toolSettings.mode);
                if (toolSettings.mediaType) setMediaType(toolSettings.mediaType);
            }

            const status = await ipc.invoke('get-tool-status');
            setIsRunning(status.scriptName === SCRIPT_NAME && status.isRunning);

            const savedLogs = await ipc.invoke('get-tool-logs');
            if (savedLogs && savedLogs.length > 0) setLogs(savedLogs);
        };
        sync();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            ipc.invoke('save-tool-settings', {
                toolId: 'common_toolbox_settings',
                settings: { imageDir: inputDir }
            });
            ipc.invoke('save-tool-settings', {
                toolId: 'mirror_flip',
                settings: { mode, mediaType }
            });
        }, 1000);
        return () => clearTimeout(timer);
    }, [inputDir, mode, mediaType]);

    const pickDir = async () => {
        const result = await ipc.invoke('dialog:openFile', { properties: ['openDirectory'] });
        if (!result.canceled && result.filePaths.length > 0) {
            setInputDir(result.filePaths[0]);
        }
    };

    const runTool = async () => {
        if (!inputDir) {
            showToast(t('toolbox.errors.no_dir'), 'error');
            return;
        }

        const args = ['--input', inputDir, '--mode', mode, '--type', mediaType];

        setLogs([]);
        setIsRunning(true);
        showToast(t('toolbox.mirror.started'), 'success');

        const result = await ipc.invoke('run-tool', { scriptName: SCRIPT_NAME, args });
        if (!result.success) {
            showToast(result.error || t('toolbox.mirror.stopped'), 'error');
            setIsRunning(false);
        }
    };

    const stopTool = async () => {
        await ipc.invoke('stop-tool');
        setIsRunning(false);
    };

    const handleOpenDir = async () => {
        if (!inputDir) return;
        const result = await ipc.invoke('open-path', inputDir);
        if (!result.success) showToast(result.error, 'error');
    };

    useEffect(() => {
        const handleOutput = (_: any, data: string) => setLogs(prev => [...prev.slice(-200), data]);
        const handleStatus = (_: any, status: any) => {
            if (status.type === 'finished' && status.scriptName === SCRIPT_NAME) {
                setIsRunning(false);
                showToast(status.isSuccess ? t('toolbox.mirror.finished') : t('toolbox.mirror.stopped'), status.isSuccess ? 'success' : 'error');
            }
        };

        const removeOutput = (ipc as any).on('tool-output', handleOutput);
        const removeStatus = (ipc as any).on('tool-status', handleStatus);
        return () => {
            removeOutput();
            removeStatus();
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [logs]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
            <GlassCard className="p-6">
                <div className="space-y-6">
                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
                                <FolderOpen className="w-4 h-4" />
                                {t('toolbox.mirror.input_dir')}
                            </label>
                            <GlassInput value={inputDir} onChange={(e) => setInputDir(e.target.value)} placeholder="C:/path/to/media" />
                        </div>
                        <GlassButton onClick={pickDir} variant="outline" className="mb-[1px]">
                            {t('common.browse')}
                        </GlassButton>
                    </div>

                    <div className="border border-white/5 rounded-xl overflow-hidden bg-white/5">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                                <FlipHorizontal2 className="w-3.5 h-3.5" />
                                {t('toolbox.mirror.config')}
                            </div>
                        </div>

                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2 h-5">
                                    <FlipHorizontal2 className="w-4 h-4 text-primary/80" />
                                    {t('toolbox.mirror.mode')}
                                </label>
                                <GlassSelect
                                    value={mode}
                                    onChange={(e) => setMode(e.target.value as FlipMode)}
                                    options={[
                                        { label: t('toolbox.mirror.horizontal'), value: 'horizontal' },
                                        { label: t('toolbox.mirror.vertical'), value: 'vertical' },
                                        { label: t('toolbox.mirror.both'), value: 'both' },
                                    ]}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2 h-5">
                                    {mediaType === 'video' ? <Video className="w-4 h-4 text-primary/80" /> : <Images className="w-4 h-4 text-primary/80" />}
                                    {t('toolbox.mirror.media_type')}
                                </label>
                                <GlassSelect
                                    value={mediaType}
                                    onChange={(e) => setMediaType(e.target.value as MediaType)}
                                    options={[
                                        { label: t('toolbox.mirror.all_media'), value: 'all' },
                                        { label: t('toolbox.mirror.images_only'), value: 'image' },
                                        { label: t('toolbox.mirror.videos_only'), value: 'video' },
                                    ]}
                                />
                            </div>
                            <div className="md:col-span-2 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-xs text-muted-foreground">
                                {t('toolbox.mirror.output_hint')}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 border border-white/5 w-fit transition-all mr-auto">
                            <div className={cn("w-1.5 h-1.5 rounded-full transition-all duration-500", isRunning ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" : "bg-blue-500/40")} />
                            <span className="text-[11px] font-medium text-muted-foreground/80 tracking-wide uppercase">
                                {isRunning ? t('common.running') : t('common.ready')}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <GlassButton onClick={handleOpenDir} variant="outline" className="gap-2" disabled={!inputDir}>
                                <ExternalLink className="w-4 h-4" />
                                {t('toolbox.open')}
                            </GlassButton>
                            {isRunning ? (
                                <GlassButton onClick={stopTool} variant="outline" className="gap-2 text-red-400">
                                    <StopCircle className="w-4 h-4" />
                                    {t('common.stop')}
                                </GlassButton>
                            ) : (
                                <GlassButton onClick={runTool} variant="default" className="gap-2">
                                    <Play className="w-4 h-4" />
                                    {t('common.start')}
                                </GlassButton>
                            )}
                        </div>
                    </div>
                </div>
            </GlassCard>

            <GlassCard className="bg-black/40 border-primary/10 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                        <Terminal className="w-3.5 h-3.5" />
                        {t('toolbox.status_logs')}
                    </div>
                </div>
                <div ref={scrollRef} className="h-[300px] overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-0.5">
                    {logs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground italic">
                            {t('toolbox.tagging.no_logs')}
                        </div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="whitespace-pre-wrap break-all opacity-90 animate-in fade-in slide-in-from-left-2 duration-300">
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </GlassCard>

            {mediaType !== 'video' && <ImagePreviewGrid directory={inputDir} className="mt-6" />}
        </div>
    );
}
