import React, { useState, useEffect } from 'react';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';

import FileExplorer from './components/FileExplorer';
import TerminalPanel from './components/TerminalPanel';
import TitleBar from './components/TitleBar';
import ActivityBar from './components/ActivityBar';
import StatusBar from './components/StatusBar';
import EditorArea from './components/EditorArea';
import AiAgentPanel from './components/AiAgentPanel';
import LoginScreen from './components/LoginScreen';
import { ElectronAPI } from './types/index';
import { useAuth } from './context/AuthContext';
import { useStorageSync } from './hooks/useStorageSync';

loader.config({
    monaco,
    paths: {
        vs: 'monaco-editor/min/vs'
    }
});

const App: React.FC = () => {
    const { session, loading: authLoading, signOut } = useAuth();
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [language, setLanguage] = useState<string>('javascript');
    const [showTerminal, setShowTerminal] = useState(true);
    const [rootPath, setRootPath] = useState<string>('');
    const [isDirty, setIsDirty] = useState(false);
    const [showAiPanel, setShowAiPanel] = useState(false);

    const { syncFileToCloud } = useStorageSync(rootPath);

    useEffect(() => {
        // Automatically open the workspace folder on start
        handleOpenFolder();

        const removeMenuListener = window.electronAPI.onMenuOpenFolder(() => {
            handleOpenFolder();
        });

        return () => {
            removeMenuListener();
        };
    }, []);

    // Note: File protection is now handled by the main process
    // The main process tracks which files are open and only protects closed files
    // This prevents conflicts with user saves

    // Listen for external file modification notifications
    useEffect(() => {
        const removeListener = window.electronAPI.onFileExternallyModified(
            ({ filePath, action }) => {
                console.log('[App] Received external modification event:', { filePath, action });
                const fileName = filePath.split(/[/\\]/).pop();

                if (action === 'reverted-modification') {
                    console.log('[App] Showing external edit alert for:', fileName);
                    window.alert(
                        `⚠️ External Edit Blocked\n\n` +
                        `The file "${fileName}" was modified by an external program (VS Code, nano, vim, etc.), ` +
                        `but the change was automatically reverted.\n\n` +
                        `📝 Workspace Protection:\n` +
                        `All files in this workspace are protected and can ONLY be edited within ScholarIDE.\n\n` +
                        `To edit this file, please open it in the ScholarIDE editor.`
                    );
                } else if (action === 'restored-deleted') {
                    console.log('[App] Showing external deletion alert for:', fileName);
                    window.alert(
                        `⚠️ External Deletion Blocked\n\n` +
                        `The file "${fileName}" was deleted by an external program or command, ` +
                        `but it has been automatically restored.\n\n` +
                        `🛡️ Workspace Protection:\n` +
                        `All files in this workspace are protected from external deletion.\n\n` +
                        `To delete this file, please use the ScholarIDE file explorer.`
                    );
                }
            }
        );

        return () => {
            removeListener();
        };
    }, []);

    const handleFileSelect = async (filePath: string) => {
        try {
            // Notify main process that we're closing the previous file
            if (selectedFile) {
                window.electronAPI.notifyFileClosed(selectedFile);
            }

            const content = await window.electronAPI.readFile(filePath);
            setFileContent(content);
            setSelectedFile(filePath);
            setIsDirty(false);

            // Notify main process that this file is now open
            window.electronAPI.notifyFileOpened(filePath);

            const ext = filePath.split('.').pop();
            switch (ext) {
                case 'ts': case 'tsx': setLanguage('typescript'); break;
                case 'js': case 'jsx': setLanguage('javascript'); break;
                case 'json': setLanguage('json'); break;
                case 'html': setLanguage('html'); break;
                case 'css': setLanguage('css'); break;
                case 'md': setLanguage('markdown'); break;
                case 'py': setLanguage('python'); break;
                default: setLanguage('plaintext');
            }
        } catch (error) {
            console.error('Failed to read file:', error);
        }
    };

    const handleOpenFolder = async () => {
        const path = await window.electronAPI.openDirectory();
        if (path) {
            setRootPath(path);
            setSelectedFile(null);
            setFileContent('');
            setIsDirty(false);
            window.electronAPI.setTerminalCwd(path);
            setShowTerminal(true); // Show terminal so user sees the change
        }
    };

    const handleEditorChange = (value: string | undefined) => {
        if (selectedFile && value !== undefined) {
            setFileContent(value);
            if (!isDirty) {
                console.log('[Editor] Content changed, setting isDirty to true');
                setIsDirty(true);
            }
        }
    };

    const handleSaveFile = async () => {
        if (selectedFile && isDirty) {
            try {
                await window.electronAPI.writeFile(selectedFile, fileContent);
                setIsDirty(false);
                console.log('File saved manually');
                // Sync to Supabase Storage
                syncFileToCloud(selectedFile, fileContent);
            } catch (error) {
                console.error('Failed to save file:', error);
            }
        }
    };

    const handleRunFile = () => {
        if (selectedFile) {
            // Check language to decide how to run
            if (language === 'python') {
                window.electronAPI.sendTerminalInput(`python3 "${selectedFile}"\n`);
                setShowTerminal(true);
            }
        }
    };

    if (!(window as any).electronAPI) {
        return <div style={{ background: 'red', color: 'white', padding: '20px' }}>Electron API not found. Preload might have failed.</div>;
    }

    // Show loading spinner while restoring session
    if (authLoading) {
        return (
            <div style={{ height: '100vh', width: '100vw', background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 13, fontFamily: 'system-ui' }}>
                Loading…
            </div>
        );
    }

    // Gate the IDE behind authentication
    if (!session) {
        return <LoginScreen />;
    }

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            background: '#1e1e1e', // Hardcoded bg to be sure
            color: 'var(--vscode-text)',
            overflow: 'hidden'
        }}>

            <TitleBar
                selectedFile={selectedFile}
                onAiToggle={() => setShowAiPanel(!showAiPanel)}
                isAiActive={showAiPanel}
            />

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                <ActivityBar />

                {/* Resizable Sidebar and Editor/Terminal area */}
                <div style={{ flex: 1 }}>
                    <Allotment>
                        <Allotment.Pane>
                            <Allotment>
                                <Allotment.Pane preferredSize={260} minSize={170}>
                                    <FileExplorer
                                        onFileSelect={handleFileSelect}
                                        currentPath={selectedFile || ''}
                                        rootPath={rootPath}
                                        onRefreshRequested={() => { }}
                                        onOpenFolder={handleOpenFolder}
                                    />
                                </Allotment.Pane>
                                <Allotment.Pane>
                                    <Allotment vertical>
                                        <Allotment.Pane>
                                            <EditorArea
                                                selectedFile={selectedFile}
                                                fileContent={fileContent}
                                                language={language}
                                                onFileClose={() => {
                                                    if (selectedFile) {
                                                        window.electronAPI.notifyFileClosed(selectedFile);
                                                    }
                                                    setSelectedFile(null);
                                                }}
                                                onContentChange={handleEditorChange}
                                                onRun={handleRunFile}
                                                onSave={handleSaveFile}
                                                isDirty={isDirty}
                                                onOpenFolder={handleOpenFolder}
                                            />
                                        </Allotment.Pane>
                                        {showTerminal && (
                                            <Allotment.Pane preferredSize={200} minSize={100}>
                                                <TerminalPanel />
                                            </Allotment.Pane>
                                        )}
                                    </Allotment>
                                </Allotment.Pane>
                            </Allotment>
                        </Allotment.Pane>
                        {showAiPanel && (
                            <Allotment.Pane preferredSize={300} minSize={200}>
                                <AiAgentPanel onClose={() => setShowAiPanel(false)} />
                            </Allotment.Pane>
                        )}
                    </Allotment>
                </div>
            </div>

            <StatusBar
                language={language}
                onTerminalToggle={() => setShowTerminal(!showTerminal)}
                onAiToggle={() => setShowAiPanel(!showAiPanel)}
                isAiActive={showAiPanel}
            />
        </div>
    );
};

export default App;
