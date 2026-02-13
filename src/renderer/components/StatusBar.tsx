import React from 'react';
import { VscSourceControl, VscTerminal, VscSparkle } from 'react-icons/vsc';

interface StatusBarProps {
    language: string;
    onTerminalToggle: () => void;
    onAiToggle: () => void;
    isAiActive: boolean;
}

const StatusBar = ({ language, onTerminalToggle, onAiToggle, isAiActive }: StatusBarProps) => {
    return (
        <footer style={{
            height: '22px',
            background: 'var(--vscode-statusbar-bg)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            fontSize: '11px',
            justifyContent: 'space-between',
            flexShrink: 0
        }}>
            <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <VscSourceControl style={{ marginRight: '5px' }} /> main*
                </div>
            </div>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        background: isAiActive ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                        padding: '0 5px',
                        height: '100%'
                    }}
                    onClick={onAiToggle}
                    title="Toggle AI Agent"
                >
                    <VscSparkle /> AI Agent
                </div>
                <div style={{ cursor: 'pointer' }} onClick={onTerminalToggle} title="Toggle Terminal">
                    <VscTerminal />
                </div>
                <div>UTF-8</div>
                <div style={{ textTransform: 'uppercase' }}>{language}</div>
            </div>
        </footer>
    );
};

export default StatusBar;
