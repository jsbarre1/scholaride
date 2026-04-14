import React, { useState, useEffect, useRef } from "react";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { Allotment } from "allotment";
import "allotment/dist/style.css";

import FileExplorer from "./components/FileExplorer";
import TerminalPanel from "./components/TerminalPanel";
import TitleBar from "./components/TitleBar";
import ActivityBar from "./components/ActivityBar";
import StatusBar from "./components/StatusBar";
import EditorArea from "./components/EditorArea";
import AiAgentPanel from "./components/AiAgentPanel";
import AssignmentsPanel from "./components/AssignmentsPanel";
import LoginScreen from "./components/LoginScreen";
import { useAuth } from "./context/AuthContext";
import { useClass } from "./context/ClassContext";
import { useFileSnapshots } from "./hooks/useFileSnapshots";
import JoinClassScreen from "./components/JoinClassScreen";
import { supabase } from "./lib/supabase";

loader.config({
  monaco,
  paths: {
    vs: "monaco-editor/min/vs",
  },
});

const App: React.FC = () => {
  const { session, user, loading: authLoading, signOut } = useAuth();
  const {
    currentClass,
    classes,
    switchClass,
    loading: classLoading,
  } = useClass();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [language, setLanguage] = useState<string>("javascript");
  const [showTerminal, setShowTerminal] = useState(true);
  const [rootPath, setRootPath] = useState<string>("");
  const [activeSidebarView, setActiveSidebarView] = useState<'files' | 'assignments' | 'search'>('files');
  const [isDirty, setIsDirty] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [pendingHeals, setPendingHeals] = useState<Map<string, string>>(
    new Map(),
  );

  const { saveSnapshot, syncAllFiles } = useFileSnapshots(rootPath);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Prevent external file drops
  useEffect(() => {
    const preventDefault = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  // Workspace-only Copy/Paste Enforcer
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection()?.toString();
      console.log("[App] Copy event. Selection length:", selection?.length || 0);
      if (selection) {
        e.preventDefault();
        window.electronAPI.clipboard.writeInternal(selection);
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const isInternal = window.electronAPI.clipboard.isInternalSync();
      console.log("[App] Paste event. Internal:", isInternal);
      
      if (!isInternal) {
        console.warn("[App] Blocking external paste event.");
        e.preventDefault();
        e.stopPropagation();
        window.alert("🚫 Paste Blocked\n\nYou can only paste content that was copied from within this ScholarIDE workspace.");
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+V (Mac) or Ctrl+V (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
        const isInternal = window.electronAPI.clipboard.isInternalSync();
        console.log("[App] Global KeyDown (Paste). Internal:", isInternal);
        if (!isInternal) {
          e.preventDefault();
          e.stopPropagation();
          console.warn("[App] Blocking external paste (Key).");
          window.alert("🚫 Paste Blocked\n\nYou can only paste content that was copied from within this ScholarIDE workspace.");
        }
      }
    };

    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste, true); // Use capture phase to intercept before Monaco
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste, true);
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, []);

  // When user logs in: tell main process which user folder to use.
  useEffect(() => {
    if (session?.user) {
      window.electronAPI.setUserId(session.user.id);
    } else if (!authLoading) {
      window.electronAPI.setUserId(null);
      setRootPath("");
      setSelectedFile(null);
      setFileContent("");
      setIsDirty(false);
    }
  }, [session?.user?.id, authLoading]);

  // Automatically open the folder for the focused class whenever it changes
  useEffect(() => {
    if (currentClass) {
      handleOpenFolder();
    }
  }, [currentClass?.id]);

  const handleOpenFolder = async () => {
    const path = await window.electronAPI.openDirectory();
    if (path) {
      setRootPath(path);
      setSelectedFile(null);
      setFileContent("");
      setIsDirty(false);
      window.electronAPI.setTerminalCwd(path);
      setShowTerminal(true);
      
      // Immediately trigger sync for the new folder
      console.log("[App] Directory changed, triggering sync for:", path);
      syncAllFiles();
    }
  };

  const performSelfHeal = async (filePath: string, expectedHash?: string) => {
    const currentUser = userRef.current;
    if (!currentUser || !rootPath || !currentClass) return;

    const fileName = filePath.split(/[/\\]/).pop();
    if (fileName === '.scholaride.dir' || fileName?.endsWith('.scholaride.hash')) {
        return;
    }

    try {
      let relPath = filePath.replace(rootPath, "");
      relPath = relPath.replace(/^[/\\]+/, "");

      console.log(
        "[App] Self-healing file:",
        relPath,
        "Class:", currentClass.name,
        "Expected Hash:",
        expectedHash,
      );

      let query = supabase
        .from("file_snapshots")
        .select("content")
        .eq("user_id", currentUser.id)
        .eq("class_id", currentClass.id) // <--- ISOLATION FIX
        .eq("file_path", relPath);

      // CRITICAL: Find the EXACT snapshot matching the last known identity
      if (expectedHash) {
        query = query.eq("content_hash", expectedHash);
      }

      const { data, error } = await query
        .order("saved_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[App] Supabase error during self-heal:", error.message);
        return;
      }

      if (!data) {
        console.warn(
          "[App] NO CLOUD BACKUP FOUND for tampered file. Permanent deletion required:",
          relPath,
        );

        // If it's tampered and has no backup, we must remove it to keep the workspace clean.
        const success = await window.electronAPI.deletePath(filePath);
        console.log("[App] Deletion of untrusted file result:", success, relPath);

        window.alert(
          "🚨 CRITICAL INTEGRITY VIOLATION\n\n" +
            `The file "${fileName}" was modified externally and its history is untrusted.\n` +
            "Because no secure cloud backup exists, this file has been PERMANENTLY REMOVED.\n\n" +
            "Security Rule: Only files created and edited within ScholarIDE are permitted.",
        );
        return;
      }

      await window.electronAPI.writeFile(filePath, data.content);
      console.log("[App] File self-healed successfully:", relPath);

      window.alert(
        `🛡️ Workspace Integrity Restored\n\n` +
          `The file "${fileName}" was modified while the IDE was closed.\n` +
          `ScholarIDE has automatically reverted it to your last secure cloud session.\n\n` +
          `Security rule: All edits must occur within ScholarIDE.`,
      );
    } catch (e) {
      console.error("[App] Self-heal failed:", e);
    }
  };

  // Effect to process pending heals once we are ready
  useEffect(() => {
    if (user && rootPath && pendingHeals.size > 0) {
      console.log("[App] Processing pending self-heals:", pendingHeals.size);
      const heals = Array.from(pendingHeals.entries());
      setPendingHeals(new Map()); // Clear queue
      heals.forEach(([path, hash]) => performSelfHeal(path, hash));
    }
  }, [user?.id, rootPath, pendingHeals]);

  useEffect(() => {
    const removeMenuListener = window.electronAPI.onMenuOpenFolder(() => {
      handleOpenFolder();
    });

    const removeIntegrityListener = window.electronAPI.onFileExternallyModified(
      ({ filePath, action, expectedHash }) => {
        const fileName = filePath.split(/[/\\]/).pop();

        if (action === "reverted-modification") {
          window.alert(
            `⚠️ External Edit Blocked\nThe file "${fileName}" was modified externally and reverted.`,
          );
        } else if (action === "restored-deleted") {
          window.alert(
            `⚠️ External Deletion Blocked\nThe file "${fileName}" was deleted externally and restored.`,
          );
        } else if (action === "unknown-file-detected") {
          // This could be a legitimate sync from another device OR an unauthorized file.
          // performSelfHeal will check cloud: 
          // -> if found: restores official version (legit).
          // -> if not found: deletes (unauthorized).
          if (!userRef.current || !rootPath) {
            setPendingHeals((prev) => {
              const next = new Map(prev);
              next.set(filePath, ""); // No hash known yet
              return next;
            });
          } else {
            performSelfHeal(filePath);
          }
        } else if (action === "offline-tampering") {
          if (!userRef.current || !rootPath) {
            console.log("[App] Queuing self-heal:", fileName);
            setPendingHeals((prev) => {
              const next = new Map(prev);
              next.set(filePath, expectedHash || "");
              return next;
            });
          } else {
            performSelfHeal(filePath, expectedHash);
          }
        }
      },
    );

    const removeFsListener = window.electronAPI.onFileSystemChanged(
      (eventType, filename) => {
        // filename comes from Chokidar, usually a full path or relative.
        // If something is deleted, check if it was our open file.
        if (eventType === "unlink" || eventType === "unlinkDir") {
          if (
            selectedFile &&
            (selectedFile === filename ||
              selectedFile.startsWith(filename + "/"))
          ) {
            console.log(
              "[App] Currently open file was deleted, clearing:",
              filename,
            );
            setSelectedFile(null);
            setFileContent("");
            setIsDirty(false);
          }
        }
      },
    );

    return () => {
      removeMenuListener();
      removeIntegrityListener();
      removeFsListener();
    };
  }, [rootPath, selectedFile]);

  const handleFileSelect = async (filePath: string) => {
    try {
      if (selectedFile) window.electronAPI.notifyFileClosed(selectedFile);
      const content = await window.electronAPI.readFile(filePath);
      setFileContent(content);
      setSelectedFile(filePath);
      setIsDirty(false);
      window.electronAPI.notifyFileOpened(filePath);

      const ext = filePath.split(".").pop();
      const langMap: Record<string, string> = {
        ts: "typescript",
        tsx: "typescript",
        js: "javascript",
        jsx: "javascript",
        json: "json",
        html: "html",
        css: "css",
        md: "markdown",
        py: "python",
      };
      setLanguage(langMap[ext || ""] || "plaintext");
    } catch (error) {
      console.error("Failed to read file:", error);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (selectedFile && value !== undefined) {
      setFileContent(value);
      if (!isDirty) setIsDirty(true);
    }
  };

  const handleSaveFile = async () => {
    if (selectedFile && isDirty) {
      try {
        await window.electronAPI.writeFile(selectedFile, fileContent);
        setIsDirty(false);
        saveSnapshot(selectedFile, fileContent);
      } catch (error) {
        console.error("Failed to save file:", error);
      }
    }
  };

  const handleRunFile = () => {
    if (selectedFile && language === "python") {
      // Calculate path relative to root to keep the command clean
      let relPath = selectedFile;
      if (selectedFile.startsWith(rootPath)) {
        relPath = selectedFile.substring(rootPath.length).replace(/^[/\\]+/, "");
      }
      
      // Use the silent runner to hide the 'cd' command
      window.electronAPI.runPythonFile(relPath);
      setShowTerminal(true);
    }
  };

  if (authLoading)
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#181818",
          color: "#666",
        }}
      >
        Loading session…
      </div>
    );
  if (!session) return <LoginScreen />;
  if (classLoading)
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#181818",
          color: "#888",
        }}
      >
        Loading class profile…
      </div>
    );

  if (!currentClass || isJoining) {
    return (
      <JoinClassScreen
        onCancel={classes.length > 0 ? () => setIsJoining(false) : undefined}
        onSuccess={() => setIsJoining(false)}
      />
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#1e1e1e",
        color: "#cccccc",
        overflow: "hidden",
      }}
    >
      <TitleBar
        selectedFile={selectedFile}
        onAiToggle={() => setShowAiPanel(!showAiPanel)}
        isAiActive={showAiPanel}
        onUpload={syncAllFiles}
      />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <ActivityBar activeView={activeSidebarView} onViewChange={setActiveSidebarView} />
        <div style={{ flex: 1 }}>
          <Allotment>
            <Allotment.Pane preferredSize={260} minSize={170}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  background: "#252526",
                }}
              >
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {activeSidebarView === 'files' ? (
                    <FileExplorer
                      onFileSelect={handleFileSelect}
                      currentPath={selectedFile || ""}
                      rootPath={rootPath}
                      onOpenFolder={handleOpenFolder}
                      onRefreshRequested={() => {}}
                    />
                  ) : activeSidebarView === 'assignments' ? (
                    <AssignmentsPanel 
                        rootPath={rootPath} 
                        saveSnapshot={saveSnapshot}
                        onAssignmentStarted={() => setActiveSidebarView('files')}
                    />
                  ) : (
                    <div style={{ padding: '20px', color: '#666', fontSize: '13px' }}>Search functionality coming soon...</div>
                  )}
                </div>
                <div
                  style={{
                    padding: "10px",
                    borderTop: "1px solid #333",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "10px",
                      color: "#888",
                      fontWeight: "bold",
                    }}
                  >
                    ACTIVE CLASS
                  </label>
                  <select
                    value={currentClass?.id || ""}
                    onChange={(e) =>
                      e.target.value === "join_new"
                        ? setIsJoining(true)
                        : switchClass(e.target.value)
                    }
                    style={{
                      background: "#3c3c3c",
                      color: "#ccc",
                      border: "1px solid #3c3c3c",
                      borderRadius: "2px",
                      padding: "4px",
                      fontSize: "11px",
                      outline: "none",
                    }}
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="join_new">+ Join another class...</option>
                  </select>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "4px 0",
                      borderTop: "1px solid #333",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {user?.email}
                    </div>
                    <button
                      onClick={signOut}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#007acc",
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane>
              <Allotment vertical>
                <Allotment.Pane>
                  <EditorArea
                    selectedFile={selectedFile}
                    fileContent={fileContent}
                    language={language}
                    onFileClose={() => {
                      if (selectedFile)
                        window.electronAPI.notifyFileClosed(selectedFile);
                      setSelectedFile(null);
                    }}
                    onContentChange={handleEditorChange}
                    onRun={handleRunFile}
                    onSave={handleSaveFile}
                    isDirty={isDirty}
                    onOpenFolder={handleOpenFolder}
                  />
                </Allotment.Pane>
                {showTerminal && (
                  <Allotment.Pane preferredSize={200} minSize={100}>
                    <TerminalPanel />
                  </Allotment.Pane>
                )}
              </Allotment>
            </Allotment.Pane>
            {showAiPanel && (
              <Allotment.Pane preferredSize={300} minSize={200}>
                <AiAgentPanel onClose={() => setShowAiPanel(false)} />
              </Allotment.Pane>
            )}
          </Allotment>
        </div>
      </div>
      <StatusBar
        language={language}
        onTerminalToggle={() => setShowTerminal(!showTerminal)}
        onAiToggle={() => setShowAiPanel(!showAiPanel)}
        isAiActive={showAiPanel}
      />
    </div>
  );
};

export default App;
