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
  openDirectory: () => Promise<string | null>;
  onMenuOpenFolder: (callback: () => void) => () => void;
  onTerminalData: (callback: (data: string) => void) => () => void;
  sendTerminalInput: (data: string) => void;
  resizeTerminal: (cols: number, rows: number) => void;
  setTerminalCwd: (cwd: string) => void;
}
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
