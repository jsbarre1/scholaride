import React from 'react';
import {
    VscFiles,
    VscSearch,
    VscSourceControl,
    VscExtensions,
    VscSettingsGear
} from 'react-icons/vsc';

const ActivityBar: React.FC = () => {
    return (
        <div style={{
            width: '48px',
            background: 'var(--vscode-activitybar-bg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '10px',
            flexShrink: 0
        }}>
            <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '2px solid white', cursor: 'pointer' }}>
                <VscFiles size={24} color="#fff" />
            </div>
            <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0.5 }}>
                <VscSearch size={24} />
            </div>
            <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0.5 }}>
                <VscSourceControl size={24} />
            </div>
            <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0.5 }}>
                <VscExtensions size={24} />
            </div>
            <div style={{ marginTop: 'auto', marginBottom: '10px', opacity: 0.5 }}>
                <VscSettingsGear size={24} />
            </div>
        </div>
    );
};

export default ActivityBar;
