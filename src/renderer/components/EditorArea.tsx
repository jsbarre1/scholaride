import React from 'react';
import Editor from '@monaco-editor/react';
import { VscFiles, VscClose, VscPlay, VscFile, VscCircleLargeFilled, VscWarning } from 'react-icons/vsc';
import { getFileIcon, getIconColor } from '../utils/icons';
import WelcomeScreen from './WelcomeScreen';

interface EditorAreaProps {
    selectedFile: string | null;
    fileContent: string;
    language: string;
    onFileClose: () => void;
    onContentChange: (value: string | undefined) => void;
    onRun?: () => void;
    onSave?: () => void;
    isDirty?: boolean;
    onOpenFolder?: () => void;
}

const EditorArea: React.FC<EditorAreaProps> = ({
    selectedFile,
    fileContent,
    language,
    onFileClose,
    onContentChange,
    onRun,
    onSave,
    isDirty,
    onOpenFolder
}) => {
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                onSave?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onSave]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Tabs area */}
            <div style={{
                height: '35px',
                background: 'var(--vscode-sidebar-bg)',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid var(--vscode-border)',
                flexShrink: 0
            }}>
                {selectedFile && (
                    <div style={{
                        height: '100%',
                        padding: '0 15px',
                        background: 'var(--vscode-bg)',
                        borderRight: '1px solid var(--vscode-border)',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '12px',
                        color: 'var(--vscode-text-selected)',
                        borderTop: '1px solid var(--vscode-statusbar-bg)'
                    }}>
                        <span style={{ marginRight: '8px', display: 'flex', alignItems: 'center', color: getIconColor(selectedFile) }}>
                            {getFileIcon(selectedFile)}
                        </span>
                        {selectedFile.split(/[/\\]/).pop()}
                        <span style={{
                            marginLeft: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer'
                        }} onClick={onFileClose}>
                            {isDirty ? (
                                <VscCircleLargeFilled size={10} style={{ opacity: 0.8 }} />
                            ) : (
                                <VscClose size={16} />
                            )}
                        </span>
                    </div>
                )}
                {/* Actions area */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: '10px' }}>
                    {isDirty && (
                        <button
                            onClick={onSave}
                            style={{
                                background: '#0e639c',
                                border: 'none',
                                color: 'white',
                                padding: '2px 10px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                borderRadius: '2px',
                                marginRight: '10px'
                            }}
                        >
                            Save
                        </button>
                    )}
                    {language === 'python' && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: '#4ec9b0',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            onClick={onRun}
                            title="Run Python File"
                        >
                            <VscPlay size={16} />
                            <span style={{ fontSize: '11px', fontWeight: 600 }}>Run</span>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
                {!selectedFile ? (
                    <WelcomeScreen onOpenFolder={onOpenFolder} />
                ) : (
                    <Editor
                        height="100%"
                        language={language}
                        value={fileContent}
                        onChange={onContentChange}
                        theme="vs-dark"
                        options={{
                            automaticLayout: true,
                            fontSize: 14,
                            fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
                            minimap: { enabled: true },
                            scrollbar: {
                                vertical: 'visible',
                                horizontal: 'visible',
                                useShadows: false,
                                verticalScrollbarSize: 10,
                                horizontalScrollbarSize: 10
                            }
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default EditorArea;
