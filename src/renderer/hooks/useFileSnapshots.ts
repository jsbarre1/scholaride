import { useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useClass } from '../context/ClassContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip workspace root to get a portable relative path ("project/main.py"). */
const relativePath = (workspacePath: string, filePath: string): string =>
    filePath.replace(workspacePath, '').replace(/^[/\\]+/, '');

/**
 * Lightweight client-side hash for skip-dedup only.
 * NOT used for any security purpose — the DB generates the authoritative hash.
 * Using Web Crypto's SHA-256 via the subtle API (available in Electron renderer).
 */
const quickHash = async (content: string): Promise<string> => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

/** Recursively collect all local file paths under a directory via IPC. */
const collectLocalFiles = async (dirPath: string): Promise<string[]> => {
    const entries: { path: string; isDirectory: boolean }[] =
        await (window as any).electronAPI.listDirectory(dirPath);

    const results: string[] = [];
    for (const entry of entries) {
        if (entry.isDirectory) {
            results.push(...await collectLocalFiles(entry.path));
        } else {
            results.push(entry.path);
        }
    }
    return results;
};

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useFileSnapshots — anti-cheat audit trail for ScholarIDE.
 *
 * On every Cmd+S, saves the full file content to the Supabase `file_snapshots`
 * table. The authoritative SHA-256 hash is computed SERVER-SIDE by Postgres
 * as a generated column — the client cannot spoof it.
 *
 * A local hash cache is used purely to skip inserts when content hasn't
 * changed since the last save (performance only, not security).
 *
 * Instructors query file_snapshots (via service-role key from a backend) to:
 *   - Review the full edit history per student
 *   - Detect plagiarism via the duplicate_snapshots view (identical hashes)
 *   - Flag suspiciously perfect code with no AI interaction history
 */
export const useFileSnapshots = (workspacePath: string) => {
    const { user } = useAuth();
    const { currentClass } = useClass();

    /**
     * Local dedup cache: relative path → quick hash of last successfully
     * inserted content. Cleared on reload/login. Security-irrelevant.
     */
    const localHashCache = useRef<Map<string, string>>(new Map());

    // ── saveSnapshot ──────────────────────────────────────────────────────────

    /**
     * Called after every successful writeFile (Cmd+S).
     * Inserts a new snapshot row if content differs from the last save.
     * The DB column `content_hash` is GENERATED from `content` server-side.
     */
    const saveSnapshot = useCallback(async (
        filePath: string,
        content: string,
    ): Promise<void> => {
        if (!user || !workspacePath || !currentClass) return;

        const rel = relativePath(workspacePath, filePath);

        // Client-side dedup: compute a local hash and skip if unchanged
        const localHash = await quickHash(content);
        if (localHashCache.current.get(rel) === localHash) {
            console.log('[FileSnapshots] No change — skipping:', rel);
            return;
        }

        // Send only {user_id, class_id, file_path, content} — DB computes content_hash
        const { error } = await supabase
            .from('file_snapshots')
            .insert({
                user_id: user.id,
                class_id: currentClass.id,
                file_path: rel,
                content,
            });

        if (error) {
            console.error(
                '[FileSnapshots] ❌ Failed to save snapshot:',
                '\n  File:', rel,
                '\n  Error:', error.message,
                '\n  Code:', error.code,
            );
        } else {
            localHashCache.current.set(rel, localHash);
            console.log('[FileSnapshots] ✅ Snapshot saved:', rel);
        }
    }, [user, workspacePath, currentClass]);

    // ── syncAllFiles ──────────────────────────────────────────────────────────

    /**
     * Walk the workspace and snapshot every file that has changed.
     * Called from the manual Sync button in the TitleBar.
     */
    const syncAllFiles = useCallback(async (): Promise<void> => {
        if (!user || !workspacePath || !currentClass) return;

        console.log('[FileSnapshots] Starting full workspace sync…');

        let filePaths: string[] = [];
        try {
            filePaths = await collectLocalFiles(workspacePath);
        } catch (e) {
            console.error('[FileSnapshots] Failed to collect local files:', e);
            return;
        }

        if (filePaths.length === 0) {
            console.log('[FileSnapshots] Workspace appears empty.');
            return;
        }

        let saved = 0;
        let skipped = 0;

        for (const fp of filePaths) {
            try {
                const content: string = await (window as any).electronAPI.readFile(fp);
                const rel = relativePath(workspacePath, fp);
                const localHash = await quickHash(content);

                if (localHashCache.current.get(rel) === localHash) {
                    skipped++;
                    continue;
                }

                const { error } = await supabase
                    .from('file_snapshots')
                    .insert({ 
                        user_id: user.id, 
                        class_id: currentClass.id,
                        file_path: rel, 
                        content 
                    });

                if (error) {
                    console.error('[FileSnapshots] ❌ Failed:', rel, error.message);
                } else {
                    localHashCache.current.set(rel, localHash);
                    saved++;
                }
            } catch (e) {
                console.error('[FileSnapshots] Error reading file:', fp, e);
            }
        }

        console.log(`[FileSnapshots] Sync complete — ${saved} saved, ${skipped} unchanged.`);
    }, [user, workspacePath, currentClass]);

    return { saveSnapshot, syncAllFiles };
};
