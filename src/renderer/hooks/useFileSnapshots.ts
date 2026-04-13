import { useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useClass } from '../context/ClassContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip workspace root to get a portable relative path ("project/main.py"). */
const relativePath = (workspacePath: string, filePath: string): string =>
    filePath.replace(workspacePath, '').replace(/^[/\\]+/, '');

/** Lightweight client-side hash for skip-dedup only. */
const quickHash = async (content: string): Promise<string> => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

/** Recursively collect all local file paths under a directory via IPC. */
const collectLocalFiles = async (dirPath: string): Promise<string[]> => {
    try {
        const entries: { path: string; name: string; isDirectory: boolean }[] =
            await (window as any).electronAPI.listDirectory(dirPath);

        const results: string[] = [];
        for (const entry of entries) {
            if (entry.isDirectory) {
                results.push(...await collectLocalFiles(entry.path));
            } else if (!entry.name.endsWith('.scholaride.hash') && !entry.name.endsWith('.scholaride.dir')) {
                results.push(entry.path);
            }
        }
        return results;
    } catch (e) {
        return [];
    }
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useFileSnapshots = (workspacePath: string) => {
    const { user } = useAuth();
    const { currentClass } = useClass();
    const localHashCache = useRef<Map<string, string>>(new Map());
    const isSyncing = useRef(false);

    const saveSnapshot = useCallback(async (
        filePath: string,
        content: string,
    ): Promise<void> => {
        if (!user || !workspacePath || !currentClass) return;

        const rel = relativePath(workspacePath, filePath);
        const localHash = await quickHash(content);
        if (localHashCache.current.get(rel) === localHash) return;

        const { error } = await supabase
            .from('file_snapshots')
            .insert({
                user_id: user.id,
                class_id: currentClass.id,
                file_path: rel,
                content,
            });

        if (!error) {
            localHashCache.current.set(rel, localHash);
        }
    }, [user, workspacePath, currentClass]);

    const syncAllFiles = useCallback(async (): Promise<void> => {
        if (!user || !workspacePath || !currentClass) return;
        if (isSyncing.current) return;

        isSyncing.current = true;
        console.log('[Sync] Starting robust integrity sync…');

        try {
            // 1. Fetch Cloud State
            const { data: cloudData, error: cloudError } = await supabase
                .from('file_snapshots')
                .select('file_path, content, saved_at')
                .eq('user_id', user.id)
                .eq('class_id', currentClass.id)
                .order('saved_at', { ascending: false });

            if (cloudError) throw cloudError;

            const latestCloudMap = new Map<string, string>();
            cloudData?.forEach(s => {
                if (!latestCloudMap.has(s.file_path)) latestCloudMap.set(s.file_path, s.content);
            });

            // 2. CLEANUP: Delete unauthorized local folders
            const topLevelEntries = await (window as any).electronAPI.listDirectory(workspacePath);
            let cleanedCount = 0;
            for (const entry of topLevelEntries) {
                if (entry.isDirectory) {
                    const dirName = entry.name.toLowerCase();
                    const ignored = ["node_modules", ".git", ".vscode", ".idea", ".scholaride"];
                    if (ignored.includes(dirName)) continue;

                    const hasCloudPresence = Array.from(latestCloudMap.keys()).some(
                        rel => rel.toLowerCase().startsWith(dirName + '/') || rel.toLowerCase() === dirName
                    );

                    if (!hasCloudPresence) {
                        await (window as any).electronAPI.deletePath(entry.path);
                        cleanedCount++;
                    }
                }
            }

            // 3. RESTORE MISSING: Ensure all cloud files exist locally
            let restoredCount = 0;
            for (const [relPath, content] of latestCloudMap.entries()) {
                const fullPath = (window as any).electronAPI.pathJoin(workspacePath, relPath);
                try {
                    await (window as any).electronAPI.readFile(fullPath);
                    // Exists, will be checked for tampering in step 4
                } catch (e) {
                    // Missing! Restore it.
                    const dirPath = (window as any).electronAPI.pathDirname(fullPath);
                    await (window as any).electronAPI.createDirectory(dirPath);
                    await (window as any).electronAPI.writeFile(fullPath, content);
                    restoredCount++;
                }
            }

            // 4. AUDIT & UPLOAD: Check remaining local files
            const localFilePaths = await collectLocalFiles(workspacePath);
            let uploadedCount = 0;
            for (const fp of localFilePaths) {
                const rel = relativePath(workspacePath, fp);
                const cloudContent = latestCloudMap.get(rel);
                
                try {
                    const localContent: string | null = await (window as any).electronAPI.readFile(fp);
                    if (localContent === null) continue; // File vanished
                    
                    const localHash = await quickHash(localContent);

                    // Check integrity sidecar
                    let storedHash: string | null = null;
                    try {
                        storedHash = await (window as any).electronAPI.readFile(fp + '.scholaride.hash');
                    } catch (e) {}

                    const isTampered = storedHash !== localHash;

                    if (isTampered) {
                        // REVERT: If different from cloud, overwrite it
                        if (cloudContent !== undefined && localContent !== cloudContent) {
                            await (window as any).electronAPI.writeFile(fp, cloudContent);
                            restoredCount++;
                        }
                    } else {
                        // LEGIT: If newer than cloud, upload it
                        if (cloudContent !== localContent) {
                            const { error } = await supabase.from('file_snapshots').insert({
                                user_id: user.id,
                                class_id: currentClass.id,
                                file_path: rel,
                                content: localContent
                            });
                            if (!error) {
                                localHashCache.current.set(rel, localHash);
                                uploadedCount++;
                            }
                        }
                    }
                } catch (e) {
                    // File might have been deleted mid-sync, skip
                }
            }

            if (restoredCount > 0 || cleanedCount > 0 || uploadedCount > 0) {
                window.alert(`✅ Sync Complete\n\n- ${restoredCount} items restored\n- ${cleanedCount} unauthorized folders cleaned\n- ${uploadedCount} backups created`);
            }
        } catch (e: any) {
            console.error('[Sync] Error:', e);
        } finally {
            isSyncing.current = false;
        }
    }, [user, workspacePath, currentClass]);

    return { saveSnapshot, syncAllFiles };
};
