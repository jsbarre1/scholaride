import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface ClassContextType {
    classes: any[];
    currentClass: any | null;
    loading: boolean;
    joinClass: (joinCode: string) => Promise<{ error: string | null }>;
    switchClass: (id: string) => Promise<void>;
    refreshEnrollments: () => Promise<void>;
}

const ClassContext = createContext<ClassContextType | undefined>(undefined);

export const ClassProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [classes, setClasses] = useState<any[]>([]);
    const [currentClass, setCurrentClass] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshEnrollments = async () => {
        if (!user) {
            setClasses([]);
            setCurrentClass(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('enrollments')
                .select('class_id, classes(*)')
                .eq('student_id', user.id);

            if (error) throw error;

            const classList = (data || []).map((d: any) => d.classes);
            setClasses(classList);

            // Try to restore the last used class from localStorage, or pick the first one
            const savedClassId = localStorage.getItem(`lastClassId_${user.id}`);
            const active = classList.find(c => c.id === savedClassId) || classList[0] || null;

            if (active) {
                setCurrentClass(active);
                await window.electronAPI.setClassId(active.id, active.name);
            } else {
                setCurrentClass(null);
                await window.electronAPI.setClassId(null, null);
            }
        } catch (error) {
            console.error('Error fetching enrollments:', error);
        } finally {
            setLoading(false);
        }
    };

    const switchClass = async (classId: string) => {
        const selected = classes.find(c => c.id === classId);
        if (selected && user) {
            setCurrentClass(selected);
            localStorage.setItem(`lastClassId_${user.id}`, selected.id);
            await window.electronAPI.setClassId(selected.id, selected.name);
        }
    };

    useEffect(() => {
        refreshEnrollments();
    }, [user?.id]);

    const joinClass = async (joinCode: string) => {
        if (!user) return { error: 'Not authenticated' };

        try {
            const { data: classData, error: classError } = await supabase
                .from('classes')
                .select('id, name')
                .eq('join_code', joinCode.toUpperCase())
                .single();

            if (classError || !classData) return { error: 'Invalid join code' };

            const { error: enrollError } = await supabase
                .from('enrollments')
                .insert({ student_id: user.id, class_id: classData.id });

            if (enrollError) {
                if (enrollError.code === '23505') return { error: 'Already enrolled' };
                return { error: enrollError.message };
            }

            // After joining, save this as the last active class so it opens immediately
            localStorage.setItem(`lastClassId_${user.id}`, classData.id);
            await refreshEnrollments();
            return { error: null };
        } catch (error: any) {
            return { error: error.message };
        }
    };

    return (
        <ClassContext.Provider value={{ classes, currentClass, loading, joinClass, switchClass, refreshEnrollments }}>
            {children}
        </ClassContext.Provider>
    );
};

export const useClass = () => {
    const context = useContext(ClassContext);
    if (context === undefined) {
        throw new Error('useClass must be used within a ClassProvider');
    }
    return context;
};
