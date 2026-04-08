import { useState } from 'react';
import { VscSparkle, VscCloudUpload } from 'react-icons/vsc';

interface TitleBarProps {
    selectedFile: string | null;
    onAiToggle: () => void;
    isAiActive: boolean;
    onUpload: () => Promise<void>;
}

const TitleBar = ({ selectedFile, onAiToggle, isAiActive, onUpload }: TitleBarProps) => {
    const [uploading, setUploading] = useState(false);

    const handleUpload = async () => {
        if (uploading) return;
        setUploading(true);
        try {
            await onUpload();
        } finally {
            setUploading(false);
        }
    };
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

            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                    {selectedFile ? `${selectedFile.split(/[/\\]/).pop()} - ScholarIDE` : 'ScholarIDE'}
                </div>
                <div
                    onClick={onAiToggle}
                    style={{
                        ['WebkitAppRegion' as any]: 'no-drag',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: isAiActive ? '#007acc' : '#333',
                        color: 'white',
                        padding: '2px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                        border: '1px solid rgba(255,255,255,0.1)'
                    } as React.CSSProperties}
                    title="Open AI Tutor"
                >
                    <VscSparkle size={12} />
                    AI Tutor
                </div>
            </div>

            <div style={{
                ['WebkitAppRegion' as any]: 'no-drag',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginRight: '10px'
            }}>
                <div
                    onClick={handleUpload}
                    style={{
                        cursor: uploading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: uploading ? '#1a3a50' : '#1e3a4f',
                        color: uploading ? '#4a9aba' : '#4ec9f0',
                        padding: '2px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                        border: '1px solid rgba(78,201,240,0.25)',
                        opacity: uploading ? 0.7 : 1,
                    } as React.CSSProperties}
                    title="Sync workspace to Supabase"
                >
                    <VscCloudUpload size={12} />
                    {uploading ? 'Syncing…' : 'Sync'}
                </div>
            </div>
        </div>
    );
};

export default TitleBar;
