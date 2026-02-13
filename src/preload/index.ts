import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  listDirectory: (path: string) => ipcRenderer.invoke("list-directory", path),
  readFile: (path: string) => ipcRenderer.invoke("read-file", path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke("write-file", path, content),
  createFile: (path: string) => ipcRenderer.invoke("create-file", path),
  getAppPath: () => ipcRenderer.invoke("get-app-path"),
  getWorkspacePath: () => ipcRenderer.invoke("get-workspace-path"),
  openDirectory: () => ipcRenderer.invoke("open-directory"),
  onMenuOpenFolder: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("menu-open-folder", listener);
    return () => ipcRenderer.removeListener("menu-open-folder", listener);
  },
  onTerminalData: (callback: (data: string) => void) => {
    const listener = (_event: any, data: string) => callback(data);
    ipcRenderer.on("terminal-data", listener);
    return () => ipcRenderer.removeListener("terminal-data", listener);
  },
  sendTerminalInput: (data: string) => ipcRenderer.send("terminal-input", data),
  resizeTerminal: (cols: number, rows: number) =>
    ipcRenderer.send("terminal-resize", { cols, rows }),
  setTerminalCwd: (cwd: string) => ipcRenderer.send("terminal-set-cwd", cwd),
  createDirectory: (path: string) =>
    ipcRenderer.invoke("create-directory", path),
  deletePath: (path: string) => ipcRenderer.invoke("delete-path", path),
  onFileSystemChanged: (
    callback: (eventType: string, filename: string) => void,
  ) => {
    const listener = (
      _event: any,
      { eventType, filename }: { eventType: string; filename: string },
    ) => callback(eventType, filename);
    ipcRenderer.on("file-system-changed", listener);
    return () => ipcRenderer.removeListener("file-system-changed", listener);
  },
  onFileExternallyModified: (
    callback: (data: { filePath: string; action: string }) => void,
  ) => {
    const listener = (
      _event: any,
      data: { filePath: string; action: string },
    ) => callback(data);
    ipcRenderer.on("file-externally-modified", listener);
    return () =>
      ipcRenderer.removeListener("file-externally-modified", listener);
  },
  notifyFileOpened: (filePath: string) =>
    ipcRenderer.send("file-opened", filePath),
  notifyFileClosed: (filePath: string) =>
    ipcRenderer.send("file-closed", filePath),
  aiChat: (messages: any[]) => ipcRenderer.invoke("ai-chat", { messages }),
});
