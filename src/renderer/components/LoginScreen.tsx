import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface LoginScreenProps {
    onSignUpSuccess?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSignUpSuccess }) => {
    const { signIn, signUp } = useAuth();
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setInfo(null);
        setLoading(true);

        if (mode === 'login') {
            const err = await signIn(email, password);
            if (err) setError(err.message);
        } else {
            const { error: err, isNewUser } = await signUp(email, password);
            if (err) {
                setError(err.message);
            } else {
                setInfo('Account created! Setting up your workspace…');
                if (isNewUser && onSignUpSuccess) {
                    onSignUpSuccess();
                }
                setMode('login');
            }
        }
        setLoading(false);
    };


    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            background: '#1e1e1e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        }}>
            <div style={{
                width: 380,
                background: '#252526',
                border: '1px solid #333',
                borderRadius: 12,
                padding: '40px 36px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}>
                {/* Logo / Brand */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: '#ffffff',
                        letterSpacing: '-0.5px',
                    }}>
                        Scholar<span style={{ color: '#007acc' }}>IDE</span>
                    </div>
                    <div style={{ color: '#666', fontSize: 13, marginTop: 6 }}>
                        {mode === 'login' ? 'Sign in to your workspace' : 'Create an account'}
                    </div>
                </div>

                {/* Tab switcher */}
                <div style={{
                    display: 'flex',
                    background: '#1e1e1e',
                    borderRadius: 8,
                    padding: 3,
                    marginBottom: 24,
                    gap: 3,
                }}>
                    {(['login', 'signup'] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => { setMode(m); setError(null); setInfo(null); }}
                            style={{
                                flex: 1,
                                padding: '7px 0',
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 500,
                                transition: 'all 0.15s',
                                background: mode === m ? '#007acc' : 'transparent',
                                color: mode === m ? '#fff' : '#888',
                            }}
                        >
                            {m === 'login' ? 'Sign In' : 'Sign Up'}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', color: '#ccc', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            placeholder="you@example.com"
                            style={{
                                width: '100%',
                                background: '#1e1e1e',
                                border: '1px solid #444',
                                borderRadius: 6,
                                padding: '9px 12px',
                                color: '#fff',
                                fontSize: 13,
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.15s',
                            }}
                            onFocus={e => e.target.style.borderColor = '#007acc'}
                            onBlur={e => e.target.style.borderColor = '#444'}
                        />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', color: '#ccc', fontSize: 12, marginBottom: 6, fontWeight: 500 }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            style={{
                                width: '100%',
                                background: '#1e1e1e',
                                border: '1px solid #444',
                                borderRadius: 6,
                                padding: '9px 12px',
                                color: '#fff',
                                fontSize: 13,
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.15s',
                            }}
                            onFocus={e => e.target.style.borderColor = '#007acc'}
                            onBlur={e => e.target.style.borderColor = '#444'}
                        />
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(244, 67, 54, 0.1)',
                            border: '1px solid rgba(244, 67, 54, 0.3)',
                            borderRadius: 6,
                            padding: '8px 12px',
                            color: '#f44336',
                            fontSize: 12,
                            marginBottom: 16,
                        }}>
                            {error}
                        </div>
                    )}

                    {info && (
                        <div style={{
                            background: 'rgba(0, 122, 204, 0.1)',
                            border: '1px solid rgba(0, 122, 204, 0.3)',
                            borderRadius: 6,
                            padding: '8px 12px',
                            color: '#007acc',
                            fontSize: 12,
                            marginBottom: 16,
                        }}>
                            {info}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '10px 0',
                            background: loading ? '#005a9e' : '#007acc',
                            border: 'none',
                            borderRadius: 6,
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'background 0.15s',
                            letterSpacing: '0.2px',
                        }}
                    >
                        {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginScreen;
