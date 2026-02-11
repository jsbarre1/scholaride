import React from 'react';

interface TitleBarProps {
    selectedFile: string | null;
}

const TitleBar: React.FC<TitleBarProps> = ({ selectedFile }) => {
    return (
        <div style={{
            height: '35px',
            background: 'var(--vscode-sidebar-bg)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            borderBottom: '1px solid var(--vscode-border)',
            zIndex: 1000,
            position: 'relative',
            WebkitAppRegion: 'drag',
            userSelect: 'none'
        } as any}>
            {/* Space for Mac Traffic Lights */}
            <div style={{ width: '70px', height: '100%' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '20px', WebkitAppRegion: 'no-drag' } as any}>
                <span style={{ fontSize: '16px' }}>🎓</span>
            </div>

            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', fontSize: '12px', opacity: 0.7 }}>
                {selectedFile ? `${selectedFile.split(/[/\\]/).pop()} - ScholarIDE` : 'ScholarIDE'}
            </div>

            <div style={{ width: '100px' }} />
        </div>
    );
};

export default TitleBar;
