import React, { useState, useRef, useEffect } from 'react';
import {
    VscFiles,
    VscSearch,
    VscSettingsGear,
    VscSignOut,
    VscAccount,
    VscNotebook,
} from 'react-icons/vsc';
import { useAuth } from '../context/AuthContext';

interface ActivityBarProps {
    activeView: 'files' | 'assignments' | 'search';
    onViewChange: (view: 'files' | 'assignments' | 'search') => void;
}

const ActivityBar: React.FC<ActivityBarProps> = ({ activeView, onViewChange }) => {
    const { user, signOut } = useAuth();
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSignOut = async () => {
        setShowMenu(false);
        await signOut();
    };

    return (
        <div style={{
            width: '48px',
            background: 'var(--vscode-activitybar-bg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '10px',
            flexShrink: 0,
            position: 'relative',
        }}>
            <div 
                onClick={() => onViewChange('files')}
                style={{ 
                    width: '48px', 
                    height: '48px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderLeft: activeView === 'files' ? '2px solid white' : '2px solid transparent', 
                    cursor: 'pointer',
                    opacity: activeView === 'files' ? 1 : 0.4
                }}
            >
                <VscFiles size={24} color="#fff" />
            </div>
            <div 
                onClick={() => onViewChange('assignments')}
                style={{ 
                    width: '48px', 
                    height: '48px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderLeft: activeView === 'assignments' ? '2px solid white' : '2px solid transparent',
                    cursor: 'pointer',
                    opacity: activeView === 'assignments' ? 1 : 0.4
                }}
            >
                <VscNotebook size={24} color="#fff" />
            </div>
            <div 
                onClick={() => onViewChange('search')}
                style={{ 
                    width: '48px', 
                    height: '48px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderLeft: activeView === 'search' ? '2px solid white' : '2px solid transparent',
                    cursor: 'pointer', 
                    opacity: activeView === 'search' ? 1 : 0.4 
                }}
            >
                <VscSearch size={24} color="#fff" />
            </div>

            {/* Settings / Account — bottom of activity bar */}
            <div ref={menuRef} style={{ marginTop: 'auto', marginBottom: '10px', position: 'relative' }}>
                <div
                    onClick={() => setShowMenu(prev => !prev)}
                    title="Account & Settings"
                    style={{
                        width: '48px',
                        height: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        opacity: showMenu ? 1 : 0.6,
                        transition: 'opacity 0.15s',
                        borderLeft: showMenu ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent',
                    }}
                >
                    <VscSettingsGear size={24} />
                </div>

                {showMenu && (
                    <div style={{
                        position: 'absolute',
                        bottom: '52px',
                        left: '52px',
                        background: '#252526',
                        border: '1px solid #3c3c3c',
                        borderRadius: '6px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        minWidth: '220px',
                        zIndex: 9999,
                        overflow: 'hidden',
                    }}>
                        {/* User info header */}
                        <div style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #3c3c3c',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                        }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#007acc',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <VscAccount size={18} color="#fff" />
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#fff',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}>
                                    {user?.email ?? 'Signed in'}
                                </div>
                                <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                                    ScholarIDE Account
                                </div>
                            </div>
                        </div>

                        {/* Sign Out button */}
                        <div
                            onClick={handleSignOut}
                            style={{
                                padding: '10px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: '#ccc',
                                transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#2a2d2e')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <VscSignOut size={16} />
                            Sign Out
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityBar;
