import React, { useEffect, useState, useRef } from 'react';
import { Tree, NodeRendererProps } from 'react-arborist';
import {
    VscFolder,
    VscNewFile,
    VscNewFolder,
    VscRefresh,
    VscChevronRight,
    VscChevronDown,
    VscFolderOpened,
    VscFile,
    VscCloudDownload
} from 'react-icons/vsc';
import { getFileIcon, getIconColor } from '../utils/icons';
import { FileEntry } from '../types/index';
import { useClass } from '../context/ClassContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface TreeData {
    id: string;
    name: string;
    isDirectory: boolean;
    children?: TreeData[];
    isOpen?: boolean;
}

interface FileExplorerProps {
    onFileSelect: (path: string) => void;
    currentPath: string;
    rootPath: string;
    onRefreshRequested: () => void;
    onOpenFolder?: () => void;
    onFileCreated?: (filePath: string, content: string) => void;
    onFileMoved?: (oldPath: string, newPath: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect, currentPath, rootPath, onRefreshRequested, onOpenFolder, onFileCreated, onFileMoved }) => {

    const [data, setData] = useState<TreeData[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const treeRef = useRef<any>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);
    const [creationType, setCreationType] = useState<'file' | 'directory'>('file');
    const [lastExpandedPath, setLastExpandedPath] = useState<string | null>(null);
    const { currentClass } = useClass();
    const { user } = useAuth();

    useEffect(() => {
        setLastExpandedPath(rootPath);
    }, [rootPath]);

    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        // Listen for file system changes from the main process
        const removeListener = window.electronAPI.onFileSystemChanged(async (eventType, filename) => {
            console.log('File system changed:', eventType, filename);
            // Ideally we'd be smarter here, but for now, let's just refresh the view.
            // A full refresh is safest to ensure alignment.
            if (rootPath) {
                const rootEntries = await loadDirectory(rootPath);
                setData(rootEntries);

                // If we had a subfolder expanded, we might want to try to preserve that state
                // Use a recursive reload approach if we wanted to be perfect, but top-level refresh is a good start.
                // If lastExpandedPath is set, we could try to reload that too.
                if (lastExpandedPath && lastExpandedPath !== rootPath) {
                    const children = await loadDirectory(lastExpandedPath);
                    setData(prevData => updateNodeChildren(prevData, lastExpandedPath, children));
                }
            }
        });
        return () => {
            removeListener();
        };
    }, [rootPath, lastExpandedPath]); // Re-bind if paths change so we have latest closures

    const loadDirectory = async (dirPath: string): Promise<TreeData[]> => {
        if (!dirPath) return [];
        try {
            const entries = await window.electronAPI.listDirectory(dirPath);
            return entries
                .sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                    return a.isDirectory ? -1 : 1;
                })
                .map((entry): TreeData => ({
                    id: entry.path,
                    name: entry.name,
                    isDirectory: entry.isDirectory,
                    children: entry.isDirectory ? [] : undefined
                }));
        } catch (error: any) {
            // If the folder was just deleted, ignore ENOENT errors
            if (error.message?.includes('ENOENT')) {
                return [];
            }
            console.error('Failed to load directory:', error);
            return [];
        }
    };

    useEffect(() => {
        const init = async () => {
            if (rootPath) {
                const rootEntries = await loadDirectory(rootPath);
                setData(rootEntries);
            }
        };
        init();
    }, [rootPath]);

    const handleToggle = async (id: string) => {
        const isOpen = treeRef.current?.isOpen(id);
        if (isOpen) {
            setLastExpandedPath(id);
            const node = findNode(data, id);
            if (node && node.isDirectory && (!node.children || node.children.length === 0)) {
                const children = await loadDirectory(id);
                setData(prevData => updateNodeChildren(prevData, id, children));
            }
        }
    };

    const findNode = (nodes: TreeData[], id: string): TreeData | null => {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
                const found = findNode(node.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    const updateNodeChildren = (nodes: TreeData[], id: string, children: TreeData[]): TreeData[] => {
        return nodes.map(node => {
            if (node.id === id) {
                return { ...node, children };
            }
            if (node.children) {
                return { ...node, children: updateNodeChildren(node.children, id, children) };
            }
            return node;
        });
    };

    const handleCreate = async () => {
        if (!newFileName) {
            setIsCreating(false);
            return;
        }
        try {
            let basePath = lastExpandedPath || rootPath;
            
            // Safety check: ensure the parent still exists
            // Get parent directory manually since 'path' is not available in renderer
            const parentDir = basePath.split(/[/\\]/).slice(0, -1).join('/') || '/';
            const entries = await window.electronAPI.listDirectory(parentDir);
            const parentExists = entries.some(e => e.path === basePath);
            
            if (!parentExists && basePath !== rootPath) {
                console.warn('[FileExplorer] Target parent no longer exists, falling back to root');
                basePath = rootPath;
            }

            const fullPath = `${basePath}/${newFileName}`;
            if (creationType === 'file') {
                await window.electronAPI.createFile(fullPath);
                // Upload the new (empty) file to cloud immediately
                if (onFileCreated) {
                    onFileCreated(fullPath, '');
                }
            } else {
                await window.electronAPI.createDirectory(fullPath);
            }

            setNewFileName('');
            setIsCreating(false);

            // If we created in a subfolder, we should reload that folder
            if (basePath === rootPath) {
                const rootEntries = await loadDirectory(rootPath);
                setData(rootEntries);
            } else {
                const children = await loadDirectory(basePath);
                setData(prevData => updateNodeChildren(prevData, basePath, children));
            }

        } catch (error) {
            console.error('Failed to create item:', error);
        }
    };

    const handleDelete = async (path: string) => {
        try {
            await window.electronAPI.deletePath(path);
            
            // Fix: If we just deleted the folder we were focused on, reset focus to root
            if (lastExpandedPath === path || lastExpandedPath?.startsWith(path + '/')) {
                setLastExpandedPath(rootPath);
            }

            // Refresh parent or root
            const rootEntries = await loadDirectory(rootPath);
            setData(rootEntries);
        } catch (error) {
            console.error('Failed to delete item:', error);
        }
    };

    const handleMove = async ({ dragIds, parentId }: { dragIds: string[]; parentId: string | null; index: number }) => {
        // parentId is the destination folder path (or null for root)
        const destDir = parentId ?? rootPath;
        const movedPaths: string[] = [];

        for (const srcPath of dragIds) {
            const fileName = srcPath.split(/[/\\]/).pop();
            if (!fileName) continue;

            const destPath = `${destDir}/${fileName}`;

            if (srcPath === destPath) continue; // dropped in same place

            try {
                await window.electronAPI.movePath(srcPath, destPath);
                movedPaths.push(srcPath);
                console.log('[FileExplorer] Moved:', srcPath, '→', destPath);
                
                // Trigger cloud move sync
                if (onFileMoved) {
                    onFileMoved(srcPath, destPath);
                }
            } catch (e) {
                console.error('[FileExplorer] Failed to move:', srcPath, e);
            }
        }

        // Refresh the tree after moves
        if (movedPaths.length > 0) {
            const rootEntries = await loadDirectory(rootPath);
            setData(rootEntries);
        }
    };

    const getDisplayName = () => {
        if (!rootPath) return 'SCHOLARIDE';
        if (currentClass?.name) return `WORKSPACE FOR ${currentClass.name.toUpperCase()}`;
        return 'WORKSPACE';
    };

    const handleContextMenu = (e: React.MouseEvent, path: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, path });
    };

    const handleRestoreFromCloud = async (pathOnDisk: string) => {
        if (!user || !rootPath) return;

        // Calculate relative path for DB lookup (CS101/main.py)
        // Note: rootPath is /Users/.../ScholarIDE-Workspace/user_id/Class_Name
        // On disk files are at /Users/.../ScholarIDE-Workspace/user_id/Class_Name/CS101/main.py
        
        // Actually, we need to know the parent root to calculate accurately.
        // We'll use the user's base folder if we have it, or just use the last parts.
        const pathParts = pathOnDisk.split(/[/\\]/);
        const workspaceName = rootPath.split(/[/\\]/).pop();
        const workspaceIndex = pathParts.indexOf(workspaceName!);
        
        const relPath = pathParts.slice(workspaceIndex + 1).join('/');

        if (!confirm(`Are you sure you want to restore "${relPath}" from the cloud? This will overwrite your local file.`)) {
            return;
        }

        try {
            console.log('[FileExplorer] Fetching latest snapshot for:', relPath);
            const { data, error } = await supabase
                .from('file_snapshots')
                .select('content')
                .eq('user_id', user.id)
                .eq('file_path', relPath)
                .order('saved_at', { ascending: false })
                .limit(1)
                .single();

            if (error) throw error;
            if (!data) throw new Error('No cloud snapshots found for this file.');

            await window.electronAPI.writeFile(pathOnDisk, data.content);
            alert('File restored successfully from cloud!');
            onRefreshRequested();
        } catch (error: any) {
            console.error('Failed to restore from cloud:', error);
            alert(`Restore failed: ${error.message}`);
        }
    };

    const Node = ({ node, style, dragHandle }: NodeRendererProps<TreeData>) => {
        const isSelected = currentPath === node.id;

        return (
            <div
                style={{
                    ...style,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--vscode-list-active)' : 'transparent',
                    color: isSelected ? 'var(--vscode-text-selected)' : 'var(--vscode-text)',
                    fontSize: '13px',
                    paddingRight: '10px',
                    userSelect: 'none',
                    height: '24px'
                }}
                className="tree-node"
                onClick={() => {
                    if (node.data.isDirectory) {
                        node.toggle();
                    } else {
                        onFileSelect(node.id);
                    }
                }}
                onContextMenu={(e) => handleContextMenu(e, node.id)}
                ref={dragHandle}
            >
                <div style={{ paddingLeft: `${node.level * 12}px`, display: 'flex', alignItems: 'center' }}>
                    <span style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', opacity: node.data.isDirectory ? 1 : 0 }}>
                        {node.data.isDirectory && (node.isOpen ? <VscChevronDown size={14} /> : <VscChevronRight size={14} />)}
                    </span>
                    <span style={{ marginRight: '6px', display: 'flex', alignItems: 'center', color: node.data.isDirectory ? '#c5c5c5' : getIconColor(node.data.name) }}>
                        {node.data.isDirectory ? (node.isOpen ? <VscFolderOpened size={16} /> : <VscFolder size={16} />) : getFileIcon(node.data.name)}
                    </span>
                    <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {node.data.name}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: 'var(--vscode-sidebar-bg)',
            color: 'var(--vscode-text)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
        }}>
            <div style={{
                padding: '10px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                letterSpacing: '0.5px',
                flexShrink: 0
            }}>
                <span style={{ fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', color: '#bbbbbb' }}>Explorer</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => { setIsCreating(true); setCreationType('file'); }}
                        title="New File"
                        style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: '2px', display: 'flex' }}
                    >
                        <VscNewFile size={16} />
                    </button>
                    <button
                        onClick={() => { setIsCreating(true); setCreationType('directory'); }}
                        title="New Folder"
                        style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: '2px', display: 'flex' }}
                    >
                        <VscNewFolder size={16} />
                    </button>
                    <button
                        onClick={async () => {
                            if (rootPath) {
                                const rootEntries = await loadDirectory(rootPath);
                                setData(rootEntries);
                            }
                        }}
                        title="Refresh"
                        style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: '2px', display: 'flex' }}
                    >
                        <VscRefresh size={16} />
                    </button>
                </div>
            </div>

            {!rootPath ? (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    textAlign: 'center',
                    color: '#888'
                }}>
                    <span style={{ marginBottom: '10px', fontSize: '13px' }}>You have not yet opened a folder.</span>
                    {onOpenFolder && (
                        <button
                            onClick={onOpenFolder}
                            style={{
                                background: '#0e639c',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                borderRadius: '2px'
                            }}
                        >
                            Open Folder
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div style={{ padding: '0 0 5px 0', flexShrink: 0 }}>
                        <div style={{
                            padding: '2px 20px',
                            background: '#383838',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'default',
                            color: '#fff'
                        }}>
                            <VscChevronDown size={14} style={{ marginRight: '5px' }} />
                            {getDisplayName()}
                        </div>
                    </div>

                    <div style={{ flex: 1, minHeight: 0 }} onClick={() => setContextMenu(null)}>
                        {isCreating && (
                            <div style={{ padding: '3px 20px 3px 30px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                {creationType === 'directory' ?
                                    <VscFolder size={16} style={{ marginRight: '8px', opacity: 0.8 }} /> :
                                    <VscFile size={16} style={{ marginRight: '8px', opacity: 0.8 }} />
                                }
                                <input
                                    autoFocus
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreate();
                                        if (e.key === 'Escape') setIsCreating(false);
                                    }}
                                    onBlur={handleCreate}
                                    style={{
                                        width: '100%',
                                        background: '#3c3c3c',
                                        border: '1px solid var(--vscode-statusbar-bg)',
                                        color: 'white',
                                        padding: '1px 4px',
                                        outline: 'none',
                                        fontSize: '12px'
                                    }}
                                    placeholder={`${creationType === 'directory' ? 'Folder Name' : 'File Name'} in ${(lastExpandedPath || rootPath || '').split(/[/\\]/).pop()}`}
                                />
                            </div>
                        )}
                        <Tree
                            data={data || []}
                            openByDefault={false}
                            width={'100%'}
                            height={1000}
                            indent={24}
                            rowHeight={24}
                            overscanCount={5}
                            onToggle={handleToggle}
                            onMove={handleMove}
                            ref={treeRef}
                        >
                            {Node}
                        </Tree>
                    </div>

                    {/* Context Menu */}
                    {contextMenu && (
                        <div style={{
                            position: 'fixed',
                            top: contextMenu.y,
                            left: contextMenu.x,
                            background: '#252526',
                            border: '1px solid #454545',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            padding: '4px 0',
                            zIndex: 1000,
                            minWidth: '150px'
                        }}>
                            <div
                                style={{ padding: '4px 12px', fontSize: '13px', cursor: 'pointer', color: '#cccccc', display: 'flex', alignItems: 'center' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(contextMenu.path);
                                    setContextMenu(null);
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#094771'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <span style={{ marginRight: '8px' }}>🗑️</span> Delete
                            </div>
                            {!data.find(d => d.id === contextMenu.path)?.isDirectory && (
                                <div
                                    style={{ padding: '4px 12px', fontSize: '13px', cursor: 'pointer', color: '#4ec9f0', display: 'flex', alignItems: 'center' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRestoreFromCloud(contextMenu.path);
                                        setContextMenu(null);
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#094771'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <VscCloudDownload size={14} style={{ marginRight: '8px' }} /> Restore from Cloud
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default FileExplorer;
