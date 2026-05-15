import { ipc } from '@/lib/ipc';
import { useState, useEffect } from 'react';
import AppLayout from './components/Layout';
import { ProjectSelectionPage } from './components/ProjectSelectionPage';
import { GlassToastProvider } from './components/ui/GlassToast';
import { WindowTitleBar } from './components/ui/WindowTitleBar';
import { useTranslation } from 'react-i18next';

// Note: web/browser fallback for IPC is now handled by `@/lib/ipc` (the
// `ipc` facade auto-routes to HTTP/WebSocket when `window.ipcRenderer`
// is absent). The previous inline fallback that re-installed
// `window.ipcRenderer` has been removed because it cannot affect the
// `ipc` reference captured at module load time.

export default function App() {

    const [currentProject, setCurrentProject] = useState<string | null>(null);
    const { i18n } = useTranslation();

    useEffect(() => {
        // Load language
        const savedLang = ipc?.invoke('get-language');
        savedLang.then((lang: string) => {
            if (lang && lang !== i18n.language) {
                i18n.changeLanguage(lang);
            }
        });

        // Load and apply theme
        const savedTheme = ipc?.invoke('get-theme');
        savedTheme.then((theme: 'light' | 'dark') => {
            const currentTheme = theme || 'dark';
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(currentTheme);
        });

        // Global drag-drop handlers to fix WSL2/Network path issues and 🚫 icon
        const handleGlobalDragOver = (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        };
        const handleGlobalDrop = (e: DragEvent) => {
            // Prevent browser from opening files if dropped outside targets
            if (e.target === document.body || e.target === document.documentElement) {
                e.preventDefault();
            }
        };

        window.addEventListener('dragover', handleGlobalDragOver);
        window.addEventListener('drop', handleGlobalDrop);
        return () => {
            window.removeEventListener('dragover', handleGlobalDragOver);
            window.removeEventListener('drop', handleGlobalDrop);
        };
    }, [i18n]);

    const handleProjectSelect = (path: string) => {
        console.log("Selected project:", path);
        setCurrentProject(path);
    };

    const handleBackToHome = () => {
        // @ts-ignore
        ipc.invoke('set-session-folder', null);
        setCurrentProject(null);
    };

    return (
        <GlassToastProvider>
            <WindowTitleBar />
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {currentProject ? (
                    <AppLayout
                        onBackToHome={handleBackToHome}
                        projectPath={currentProject}
                        onProjectRenamed={(newPath) => setCurrentProject(newPath)}
                    />
                ) : (
                    <ProjectSelectionPage onSelect={handleProjectSelect} />
                )}
            </div>
        </GlassToastProvider>
    );
}
