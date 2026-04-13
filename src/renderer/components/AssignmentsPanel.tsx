import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useClass } from "../context/ClassContext";
import { useAuth } from "../context/AuthContext";
import { VscCloudDownload, VscLoading, VscCheck } from "react-icons/vsc";
import { Assignment } from "../types";

interface AssignmentsPanelProps {
  rootPath: string;
  saveSnapshot: (path: string, content: string) => Promise<void>;
  onAssignmentStarted: (title: string) => void;
}

const AssignmentsPanel: React.FC<AssignmentsPanelProps> = ({
  rootPath,
  saveSnapshot,
  onAssignmentStarted,
}) => {
  const { currentClass } = useClass();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [startedAssignmentDirs, setStartedAssignmentDirs] = useState<Set<string>>(new Set());
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentClass && user) {
      fetchAssignments();
    }
  }, [currentClass?.id, user?.id, rootPath]);

  const fetchAssignments = async () => {
    if (!currentClass || !user) return;
    setLoading(true);
    try {
      // 1. Fetch assignments from database
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("assignments")
        .select("*")
        .eq("class_id", currentClass.id)
        .order("created_at", { ascending: false });

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // 2. Fetch cloud snapshots to check 'started' status cross-device
      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from("file_snapshots")
        .select("file_path")
        .eq("user_id", user.id)
        .eq("class_id", currentClass.id)
        .limit(2000);

      if (snapshotsError) throw snapshotsError;

      const startedDirs = new Set<string>();

      // Add cloud-tracked directories
      snapshotsData?.forEach((s) => {
        const firstPart = s.file_path.split(/[/\\]/)[0];
        if (firstPart) startedDirs.add(firstPart.toLowerCase());
      });

      // 3. Add local directories (instant check)
      if (rootPath) {
        try {
          const localEntries = await window.electronAPI.listDirectory(rootPath);
          localEntries.forEach((entry: any) => {
            if (entry.isDirectory) {
              startedDirs.add(entry.name.toLowerCase());
            }
          });
        } catch (e) {
          console.error("[Assignments] Local check failed:", e);
        }
      }

      setStartedAssignmentDirs(startedDirs);

      // 4. Fetch existing submissions for this user/class
      const { data: submissionsData, error: submissionsError } = await supabase
        .from("submissions")
        .select("assignment_id")
        .eq("student_id", user.id);

      if (submissionsError) throw submissionsError;
      
      const subIds = new Set<string>();
      submissionsData?.forEach(s => subIds.add(s.assignment_id));
      setSubmittedIds(subIds);
    } catch (e) {
      console.error("Error fetching assignments:", e);
    } finally {
      setLoading(false);
    }
  };

  const startAssignment = async (assignment: Assignment) => {
    if (!rootPath) {
      alert("Please open a workspace first.");
      return;
    }

    setDownloadingId(assignment.id);
    try {
      // 1. Create directory for assignment
      const dirName = assignment.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const assignmentPath = `${rootPath}/${dirName}`;

      await window.electronAPI.createDirectory(assignmentPath);

      // 2. Create starter files
      const files = assignment.starter_files || [];
      for (const file of files) {
        const filePath = `${assignmentPath}/${file.path}`;

        // Ensure subdirectories exist
        if (file.path.includes("/") || file.path.includes("\\")) {
          const parts = file.path.split(/[/\\]/);
          parts.pop();
          const subDir = parts.join("/");
          await window.electronAPI.createDirectory(`${assignmentPath}/${subDir}`);
        }

        await window.electronAPI.writeFile(filePath, file.content);

        // Sync to cloud
        try {
          await saveSnapshot(filePath, file.content);
        } catch (e) {
          console.error("[Assignments] initial sync failed:", filePath, e);
        }
      }

      if (onAssignmentStarted) onAssignmentStarted(assignment.title);
      setStartedAssignmentDirs((prev) => new Set(prev).add(dirName));
      alert(`Assignment "${assignment.title}" started!`);
    } catch (e) {
      console.error("Error starting assignment:", e);
      alert("Failed to start assignment.");
    } finally {
      setDownloadingId(null);
    }
  };

  const submitAssignment = async (assignment: Assignment) => {
    if (!rootPath || !user) return;

    const confirmSubmit = window.confirm(`Are you sure you want to submit "${assignment.title}"? This will upload your current code for grading.`);
    if (!confirmSubmit) return;

    setSubmittingId(assignment.id);
    try {
      const dirName = assignment.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const assignmentPath = `${rootPath}/${dirName}`;

      // 1. Gather all files in the assignment directory
      const files = await window.electronAPI.listAllFiles(assignmentPath);

      if (files.length === 0) {
        alert("No files found to submit. Make sure you have created some files in the assignment folder.");
        return;
      }

      // 2. Submit to Supabase
      const { error } = await supabase
        .from("submissions")
        .upsert({
          assignment_id: assignment.id,
          student_id: user.id,
          content: files,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSubmittedIds(prev => new Set(prev).add(assignment.id));
      alert(`Assignment "${assignment.title}" submitted successfully!`);
    } catch (e) {
      console.error("Error submitting assignment:", e);
      alert("Failed to submit assignment. Please try again.");
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#666" }}>
        <VscLoading className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#252526", color: "#ccc" }}>
      <div style={{ padding: "10px 16px", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "#888", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Assignments</span>
        <button onClick={fetchAssignments} style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: "10px" }}>
          Refresh
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
        {assignments.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#666", textAlign: "center", marginTop: "40px", padding: "0 20px" }}>
            No assignments found for this class.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {assignments.map((a) => {
              const dirName = a.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
              const isStarted = startedAssignmentDirs.has(dirName);

              return (
                <div key={a.id} style={{ padding: "12px", background: "#2d2d2d", borderRadius: "4px", border: "1px solid #3c3c3c", opacity: isStarted ? 0.8 : 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#eee" }}>{a.title}</div>
                  <div style={{ fontSize: "11px", color: "#aaa", marginBottom: "10px", lineHeight: "1.5", maxHeight: "4.5em", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                    {a.description}
                  </div>

                  {a.due_date && (
                    <div style={{ fontSize: "10px", color: "#777", marginBottom: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                      Due: {new Date(a.due_date).toLocaleDateString()}
                    </div>
                  )}

                  <button
                    onClick={() => !isStarted && startAssignment(a)}
                    disabled={downloadingId === a.id || isStarted}
                    style={{
                      width: "100%",
                      padding: "8px",
                      background: downloadingId === a.id ? "#333" : isStarted ? "#2d2d2d" : "#007acc",
                      color: isStarted ? "#888" : "#fff",
                      border: isStarted ? "1px solid #444" : "none",
                      borderRadius: "3px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: downloadingId === a.id || isStarted ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (downloadingId !== a.id && !isStarted) e.currentTarget.style.background = "#0062a3";
                    }}
                    onMouseLeave={(e) => {
                      if (downloadingId !== a.id && !isStarted) e.currentTarget.style.background = "#007acc";
                    }}
                  >
                    {downloadingId === a.id ? (
                      <>
                        <VscLoading className="animate-spin" /> Starting...
                      </>
                    ) : isStarted ? (
                      <>
                        <VscCheck size={14} /> Started
                      </>
                    ) : (
                      <>
                        <VscCloudDownload size={14} /> Start Assignment
                      </>
                    )}
                  </button>

                  {isStarted && (
                    <button
                      onClick={() => !submittedIds.has(a.id) && submitAssignment(a)}
                      disabled={submittingId === a.id || submittedIds.has(a.id)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        marginTop: "8px",
                        background: submittingId === a.id ? "#333" : submittedIds.has(a.id) ? "#1e1e1e" : "#28a745",
                        color: submittedIds.has(a.id) ? "#28a745" : "#fff",
                        border: submittedIds.has(a.id) ? "1px solid #28a745" : "none",
                        borderRadius: "3px",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: submittingId === a.id || submittedIds.has(a.id) ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (submittingId !== a.id && !submittedIds.has(a.id)) e.currentTarget.style.background = "#218838";
                      }}
                      onMouseLeave={(e) => {
                        if (submittingId !== a.id && !submittedIds.has(a.id)) e.currentTarget.style.background = "#28a745";
                      }}
                    >
                      {submittingId === a.id ? (
                        <>
                          <VscLoading className="animate-spin" /> Submitting...
                        </>
                      ) : submittedIds.has(a.id) ? (
                        <>
                          <VscCheck size={14} /> Submitted
                        </>
                      ) : (
                        <>
                          <VscCloudDownload size={14} style={{ transform: "rotate(180deg)" }} /> Submit Assignment
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentsPanel;
