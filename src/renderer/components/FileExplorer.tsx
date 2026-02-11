import React, { useEffect, useState, useRef } from 'react';
import { Tree, NodeRendererProps } from 'react-arborist';
import {
    VscFolder,
    VscNewFile,
    VscRefresh,
    VscChevronRight,
    VscChevronDown,
    VscFolderOpened,
    VscFile
} from 'react-icons/vsc';
import { getFileIcon, getIconColor } from '../utils/icons';
import { FileEntry } from '../types/index';

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
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect, currentPath, rootPath, onRefreshRequested, onOpenFolder }) => {
    const [data, setData] = useState<TreeData[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const treeRef = useRef<any>(null);

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
        } catch (error) {
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

    const handleCreateFile = async () => {
        if (!newFileName) {
            setIsCreating(false);
            return;
        }
        try {
            const fullPath = `${rootPath}/${newFileName}`;
            await window.electronAPI.createFile(fullPath);
            setNewFileName('');
            setIsCreating(false);
            const rootEntries = await loadDirectory(rootPath);
            setData(rootEntries);
        } catch (error) {
            console.error('Failed to create file:', error);
        }
    };

    const getDisplayName = () => {
        if (!rootPath) return 'SCHOLARIDE';
        const parts = rootPath.split(/[/\\]/);
        return parts[parts.length - 1].toUpperCase();
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
            flexDirection: 'column'
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
                <div style={{ display: 'flex', gap: '2px' }}>
                    <button
                        onClick={() => setIsCreating(true)}
                        title="New File"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#ccc',
                            cursor: 'pointer',
                            padding: '2px 5px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <VscNewFile size={16} />
                    </button>
                    <button
                        onClick={async () => {
                            if (rootPath) {
                                const rootEntries = await loadDirectory(rootPath);
                                setData(rootEntries);
                            }
                        }}
                        title="Refresh"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#ccc',
                            cursor: 'pointer',
                            padding: '2px 5px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
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

                    <div style={{ flex: 1, minHeight: 0 }}>
                        {isCreating && (
                            <div style={{ padding: '3px 20px 3px 30px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                <VscFile size={16} style={{ marginRight: '8px', opacity: 0.8 }} />
                                <input
                                    autoFocus
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                                    onBlur={handleCreateFile}
                                    style={{
                                        width: '100%',
                                        background: '#3c3c3c',
                                        border: '1px solid var(--vscode-statusbar-bg)',
                                        color: 'white',
                                        padding: '1px 4px',
                                        outline: 'none',
                                        fontSize: '12px'
                                    }}
                                />
                            </div>
                        )}
                        <Tree
                            data={data || []}
                            openByDefault={false}
                            width={'100%'}
                            height={1000} // Parent container will clip it
                            indent={24}
                            rowHeight={24}
                            overscanCount={5}
                            onToggle={handleToggle}
                            ref={treeRef}
                        >
                            {Node}
                        </Tree>
                    </div>
                </>
            )}
        </div>
    );
};

export default FileExplorer;
