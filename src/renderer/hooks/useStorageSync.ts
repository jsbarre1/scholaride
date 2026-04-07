import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const BUCKET = 'workspaces';

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
 * Recursively list all file paths under a prefix in Supabase Storage.
 * Supabase list() is not recursive — folders have item.id === null.
 */
const listAllFiles = async (prefix: string): Promise<string[]> => {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: 500, sortBy: { column: 'name', order: 'asc' } });

    if (error || !data) return [];

    const results: string[] = [];
    for (const item of data) {
        if (item.id === null) {
            const subFiles = await listAllFiles(`${prefix}/${item.name}`);
            results.push(...subFiles);
        } else {
            results.push(`${prefix}/${item.name}`);
        }
    }
    return results;
};

/**
 * Recursively collect all local file paths under a directory via IPC.
 */
const collectLocalFiles = async (dirPath: string): Promise<{ path: string; isDirectory: boolean }[]> => {
    const entries: { path: string; isDirectory: boolean }[] = await (window as any).electronAPI.listDirectory(dirPath);
    const results: { path: string; isDirectory: boolean }[] = [];

    for (const entry of entries) {
        if (entry.isDirectory) {
            const children = await collectLocalFiles(entry.path);
            results.push(...children);
        } else {
            results.push(entry);
        }
    }
    return results;
};

/**
 * Hook: syncs the workspace to Supabase Storage.
 *
 * - On login: downloads all files from cloud → local workspace (recursively)
 * - syncFileToCloud(path, content): upload a single file (call on create)
 * - uploadWorkspace(): upload all local files (call on sign-up or manual button)
 * - downloadAll(): restore workspace from cloud (runs once on login)
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

        const allFiles = await listAllFiles(user.id);

        if (allFiles.length === 0) {
            console.log('[StorageSync] No files in cloud yet — nothing to download.');
            return;
        }

        for (const cloudPath of allFiles) {
            const { data, error } = await supabase.storage
                .from(BUCKET)
                .download(cloudPath);

            if (error || !data) {
                console.error('[StorageSync] Download error for', cloudPath, error?.message);
                continue;
            }

            const content = await data.text();
            const relative = cloudPath.replace(`${user.id}/`, '');
            const localPath = `${workspacePath}/${relative}`;

            try {
                const parentDir = localPath.substring(0, localPath.lastIndexOf('/'));
                if (parentDir !== workspacePath) {
                    await (window as any).electronAPI.createDirectory(parentDir);
                }
                await (window as any).electronAPI.writeFile(localPath, content);
                console.log('[StorageSync] Downloaded to:', localPath);
            } catch (e) {
                console.error('[StorageSync] Failed to write local file:', localPath, e);
            }
        }

        console.log('[StorageSync] Workspace download complete.');
    }, [user, workspacePath]);

    // Run download once when user logs in and workspace path is ready
    useEffect(() => {
        if (user && workspacePath && !hasSyncedOnLogin.current) {
            hasSyncedOnLogin.current = true;
            downloadAll();
        }
    }, [user, workspacePath, downloadAll]);

    /**
     * Upload a single file to cloud.
     * Call this when a new file is created or for a targeted single-file sync.
     */
    const syncFileToCloud = useCallback(async (filePath: string, content: string) => {
        if (!user || !workspacePath) return;
        await uploadFile(user.id, workspacePath, filePath, content);
    }, [user, workspacePath]);

    /**
     * Upload every file in the local workspace to cloud.
     * Call this on sign-up (initial push) or when the user clicks the manual upload button.
     */
    const uploadWorkspace = useCallback(async (): Promise<void> => {
        if (!user || !workspacePath) return;

        console.log('[StorageSync] Uploading full workspace to cloud...');

        let files: { path: string; isDirectory: boolean }[] = [];
        try {
            files = await collectLocalFiles(workspacePath);
        } catch (e) {
            console.error('[StorageSync] Failed to collect local files:', e);
            return;
        }

        for (const file of files) {
            try {
                const content: string = await (window as any).electronAPI.readFile(file.path);
                await uploadFile(user.id, workspacePath, file.path, content);
            } catch (e) {
                console.error('[StorageSync] Failed to upload file:', file.path, e);
            }
        }

        console.log('[StorageSync] Full workspace upload complete.');
    }, [user, workspacePath]);

    return { syncFileToCloud, downloadAll, uploadWorkspace };
};
