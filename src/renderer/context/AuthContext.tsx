import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<AuthError | null>;
    signUp: (email: string, password: string) => Promise<AuthError | null>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load existing session on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        // Listen for deep-link OAuth callbacks forwarded from main process
        const handleOAuthCallback = (_event: any, url: string) => {
            const hashParams = new URLSearchParams(url.split('#')[1] || '');
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken && refreshToken) {
                supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            }
        };

        if ((window as any).electronAPI?.onOAuthCallback) {
            (window as any).electronAPI.onOAuthCallback(handleOAuthCallback);
        }

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email: string, password: string): Promise<AuthError | null> => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error;
    };

    const signUp = async (email: string, password: string): Promise<AuthError | null> => {
        const { error } = await supabase.auth.signUp({ email, password });
        return error;
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextValue => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
    return ctx;
};
