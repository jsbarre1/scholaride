import React from 'react';
import { VscSourceControl, VscTerminal } from 'react-icons/vsc';

interface StatusBarProps {
    language: string;
    onTerminalToggle: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({ language, onTerminalToggle }) => {
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
