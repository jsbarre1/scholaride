export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

export interface ElectronAPI {
  listDirectory: (path: string) => Promise<FileEntry[]>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<boolean>;
  createFile: (path: string) => Promise<boolean>;
  getAppPath: () => Promise<string>;
  getWorkspacePath: () => Promise<string>;
  openDirectory: () => Promise<string | null>;
  onMenuOpenFolder: (callback: () => void) => () => void;
  onTerminalData: (callback: (data: string) => void) => () => void;
  sendTerminalInput: (data: string) => void;
  resizeTerminal: (cols: number, rows: number) => void;
  setTerminalCwd: (cwd: string) => void;
  createDirectory: (path: string) => Promise<boolean>;
  deletePath: (path: string) => Promise<boolean>;
  onFileSystemChanged: (
    callback: (eventType: string, filename: string) => void,
  ) => () => void;
  onFileExternallyModified: (
    callback: (data: { filePath: string; action: string }) => void,
  ) => () => void;
  notifyFileOpened: (filePath: string) => void;
  notifyFileClosed: (filePath: string) => void;
  aiChat: (messages: any[]) => Promise<any>;
  onOAuthCallback: (callback: (event: any, url: string) => void) => () => void;
}
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
