export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

export enum UserRole {
  ADMIN = "admin",
  INSTRUCTOR = "instructor",
  STUDENT = "student",
}

export interface ElectronAPI {
  listDirectory: (path: string) => Promise<FileEntry[]>;
  readFile: (path: string) => Promise<string>;
  listAllFiles: (path: string) => Promise<Array<{ path: string; content: string }>>;
  writeFile: (path: string, content: string) => Promise<boolean>;
  createFile: (path: string) => Promise<boolean>;
  getAppPath: () => Promise<string>;
  getWorkspacePath: () => Promise<string>;
  openDirectory: () => Promise<string | null>;
  setUserId: (userId: string | null) => Promise<string>;
  setClassId: (
    classId: string | null,
    className?: string | null,
  ) => Promise<string>;
  onMenuOpenFolder: (callback: () => void) => () => void;
  onTerminalData: (callback: (data: string) => void) => () => void;
  sendTerminalInput: (data: string) => void;
  runPythonFile: (relPath: string) => void;
  resizeTerminal: (cols: number, rows: number) => void;
  setTerminalCwd: (cwd: string) => void;
  createDirectory: (path: string) => Promise<boolean>;
  deletePath: (path: string) => Promise<boolean>;
  movePath: (sourcePath: string, destPath: string) => Promise<boolean>;
  onFileSystemChanged: (
    callback: (eventType: string, filename: string) => void,
  ) => () => void;
  onFileExternallyModified: (
    callback: (data: {
      filePath: string;
      action: string;
      expectedHash?: string;
    }) => void,
  ) => () => void;
  notifyFileOpened: (filePath: string) => void;
  notifyFileClosed: (filePath: string) => void;
  aiChat: (messages: any[]) => Promise<any>;
  onOAuthCallback: (callback: (event: any, url: string) => void) => () => void;
  pathJoin: (...args: string[]) => string;
  pathDirname: (p: string) => string;
  clipboard: {
    writeInternal: (text: string) => void;
    readInternal: () => Promise<{ text: string; isInternal: boolean }>;
    isInternalSync: () => boolean;
  };
}
export interface Assignment {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  starter_files: Array<{ path: string; content: string }>;
  created_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  content: Array<{ path: string; content: string }>;
  score: number | null;
  feedback: string | null;
  submitted_at: string;
  updated_at: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
