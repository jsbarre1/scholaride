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
            <p style={{ opacity: 0.5, marginBottom: '30px' }}>Click the assignments tab to start working.</p>
        </div>
    );
};

export default WelcomeScreen;
