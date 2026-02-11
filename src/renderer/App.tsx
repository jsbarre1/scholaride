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
import { ElectronAPI } from './types/index';

loader.config({ monaco });

const App: React.FC = () => {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [language, setLanguage] = useState<string>('javascript');
    const [showTerminal, setShowTerminal] = useState(true);
    const [rootPath, setRootPath] = useState<string>('');
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        const removeMenuListener = window.electronAPI.onMenuOpenFolder(() => {
            handleOpenFolder();
        });

        return () => {
            removeMenuListener();
        };
    }, []);

    const handleFileSelect = async (filePath: string) => {
        try {
            const content = await window.electronAPI.readFile(filePath);
            setSelectedFile(filePath);
            setFileContent(content);
            setIsDirty(false);

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
            setIsDirty(true);
        }
    };

    const handleSaveFile = async () => {
        if (selectedFile && isDirty) {
            try {
                await window.electronAPI.writeFile(selectedFile, fileContent);
                setIsDirty(false);
                console.log('File saved manually');
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

            <TitleBar selectedFile={selectedFile} />

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                <ActivityBar />

                {/* Resizable Sidebar and Editor/Terminal area */}
                <div style={{ flex: 1 }}>
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
                                        onFileClose={() => setSelectedFile(null)}
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
                </div>
            </div>

            <StatusBar
                language={language}
                onTerminalToggle={() => setShowTerminal(!showTerminal)}
            />
        </div>
    );
};

export default App;
