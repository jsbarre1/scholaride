import React, { useState } from 'react';
import { useClass } from '../context/ClassContext';
import { useAuth } from '../context/AuthContext';
import { VscSignOut, VscArrowLeft, VscKey } from 'react-icons/vsc';

interface JoinClassScreenProps {
    onCancel?: () => void;
    onSuccess?: () => void;
}

const JoinClassScreen: React.FC<JoinClassScreenProps> = ({ onCancel, onSuccess }) => {
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const { joinClass } = useClass();
    const { signOut, user } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code) return;

        setIsJoining(true);
        setError(null);
        
        const { error: joinError } = await joinClass(code);
        
        if (joinError) {
            setError(joinError);
            setIsJoining(false);
        } else if (onSuccess) {
            onSuccess();
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#181818',
            color: '#cccccc',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}>
            <div style={{
                width: '380px',
                padding: '40px',
                background: '#1e1e1e',
                borderRadius: '4px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                border: '1px solid #333',
                textAlign: 'left'
            }}>
                <div style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <VscKey size={24} color="#007acc" />
                        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 500, color: '#ffffff' }}>Join a Class</h1>
                    </div>
                    <p style={{ margin: 0, color: '#888888', fontSize: '13px', lineHeight: '1.5' }}>
                        Enter the join code provided by your instructor to connect your workspace.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            fontSize: '11px', 
                            fontWeight: 600, 
                            textTransform: 'uppercase', 
                            color: '#999999',
                            letterSpacing: '0.5px'
                        }}>
                            CODE
                        </label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="XXXXXXXX"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                background: '#3c3c3c',
                                border: '1px solid #3c3c3c',
                                borderRadius: '2px',
                                color: '#ffffff',
                                fontSize: '15px',
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.1s',
                                letterSpacing: '1px',
                                fontFamily: 'monospace'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#007acc'}
                            onBlur={(e) => e.target.style.borderColor = '#3c3c3c'}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div style={{ 
                            padding: '12px', 
                            background: 'rgba(241, 76, 76, 0.1)', 
                            border: '1px solid #f14c4c', 
                            borderRadius: '2px',
                            color: '#f14c4c',
                            fontSize: '12px',
                            marginBottom: '20px',
                            lineHeight: '1.4'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isJoining || !code}
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: isJoining || !code ? '#333' : '#007acc',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '2px',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: isJoining || !code ? 'not-allowed' : 'pointer',
                            transition: 'background 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                    >
                        {isJoining ? 'Enrolling...' : 'Join Class'}
                    </button>
                </form>

                <div style={{ 
                    marginTop: '32px', 
                    paddingTop: '20px', 
                    borderTop: '1px solid #333', 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    {onCancel ? (
                        <button
                            onClick={onCancel}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#cccccc',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                opacity: 0.7,
                                transition: 'opacity 0.2s',
                                padding: 0
                            }}
                            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                        >
                            <VscArrowLeft size={14} />
                            Go Back
                        </button>
                    ) : (
                        <div style={{ fontSize: '12px', color: '#555' }}>
                            Account: {user?.email?.split('@')[0]}
                        </div>
                    )}

                    <button
                        onClick={() => signOut()}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#cccccc',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: 0.7,
                            transition: 'opacity 0.2s',
                            padding: 0
                        }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                    >
                        <VscSignOut size={14} />
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JoinClassScreen;
