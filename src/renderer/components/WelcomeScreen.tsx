import React from 'react';

interface WelcomeScreenProps {
    onOpenFolder?: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenFolder }) => {
    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            color: 'var(--vscode-text)'
        }}>
            <span style={{ fontSize: '120px', opacity: 0.2 }}>🎓</span>
            <h1 style={{ marginTop: '20px', fontWeight: 300, opacity: 0.8 }}>ScholarIDE</h1>
            <p style={{ opacity: 0.5, marginBottom: '30px' }}>Start by opening a folder to work on.</p>

            {onOpenFolder && (
                <button
                    onClick={onOpenFolder}
                    style={{
                        background: '#0e639c',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        borderRadius: '2px'
                    }}
                >
                    Open Folder
                </button>
            )}
        </div>
    );
};

export default WelcomeScreen;
