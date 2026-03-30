import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const BUCKET = 'workspaces';

/**
 * Returns the Supabase storage path for a file, scoped to the user.
 * e.g. "{userId}/welcome.md"
 */
const storagePath = (userId: string, workspacePath: string, filePath: string): string => {
    const relative = filePath.replace(workspacePath, '').replace(/^[/\\]/, '');
    return `${userId}/${relative}`;
};

/**
 * Upload a single file to Supabase Storage.
 */
export const uploadFile = async (
    userId: string,
    workspacePath: string,
    filePath: string,
    content: string,
): Promise<void> => {
    const path = storagePath(userId, workspacePath, filePath);
    const blob = new Blob([content], { type: 'text/plain' });

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { upsert: true });

    if (error) {
        console.error('[StorageSync] Upload failed:', filePath, error.message);
    } else {
        console.log('[StorageSync] Uploaded:', path);
    }
};

/**
 * Hook: syncs the workspace to Supabase Storage.
 *
 * - On login: downloads all files from cloud → workspace
 * - After each save: uploads the changed file to cloud
 *
 * Usage:
 *   const { syncFileToCloud } = useStorageSync(workspacePath);
 *   // call syncFileToCloud(filePath, content) after every successful writeFile
 */
export const useStorageSync = (workspacePath: string) => {
    const { user } = useAuth();
    const hasSyncedOnLogin = useRef(false);

    /**
     * Download all files from this user's cloud storage into the local workspace.
     * Called once on login.
     */
    const downloadAll = useCallback(async () => {
        if (!user || !workspacePath) return;

        console.log('[StorageSync] Downloading workspace from cloud...');

        const { data: files, error } = await supabase.storage
            .from(BUCKET)
            .list(user.id, { limit: 500, offset: 0, sortBy: { column: 'name', order: 'asc' } });

        if (error) {
            console.error('[StorageSync] Failed to list files:', error.message);
            return;
        }

        if (!files || files.length === 0) {
            console.log('[StorageSync] No files in cloud yet — nothing to download.');
            return;
        }

        for (const file of files) {
            if (file.id === null) continue; // skip folders

            const cloudPath = `${user.id}/${file.name}`;
            const { data, error: dlError } = await supabase.storage
                .from(BUCKET)
                .download(cloudPath);

            if (dlError || !data) {
                console.error('[StorageSync] Download error for', cloudPath, dlError?.message);
                continue;
            }

            const content = await data.text();
            const localPath = `${workspacePath}/${file.name}`;

            try {
                await (window as any).electronAPI.writeFile(localPath, content);
                console.log('[StorageSync] Downloaded to:', localPath);
            } catch (e) {
                console.error('[StorageSync] Failed to write local file:', localPath, e);
            }
        }
    }, [user, workspacePath]);

    // Run download once when user logs in and workspace is ready
    useEffect(() => {
        if (user && workspacePath && !hasSyncedOnLogin.current) {
            hasSyncedOnLogin.current = true;
            downloadAll();
        }
    }, [user, workspacePath, downloadAll]);

    /**
     * Upload a single file to cloud after a local save.
     * Call this from App.tsx right after writeFile() succeeds.
     */
    const syncFileToCloud = useCallback(async (filePath: string, content: string) => {
        if (!user || !workspacePath) return;
        await uploadFile(user.id, workspacePath, filePath, content);
    }, [user, workspacePath]);

    return { syncFileToCloud, downloadAll };
};
