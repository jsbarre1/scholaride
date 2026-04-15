import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Calendar, 
  FileCode,
  Loader2,
  X,
  PlusCircle,
  Eye,
  AlertCircle,
  Pencil,
} from 'lucide-react';

interface StarterFile {
  path: string;
  content: string;
}

interface Assignment {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  starter_files: StarterFile[];
  created_at: string;
}

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  // content now comes via submission_snapshots → file_snapshots
  snapshots: Array<{ file_path: string; content: string; snapshot_id: string }>;
  score: number | null;
  feedback: string | null;
  submitted_at: string;
  profiles: {
    display_name: string;
  };
}

interface Course {
  id: string;
  name: string;
}

interface DuplicateSnapshot {
  class_id: string;
  file_path: string;
  student_ids: string[];
}

const Assignments: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialCourseId = queryParams.get('courseId') || 'all';
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateSnapshot[]>([]);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [viewingAssignment, setViewingAssignment] = useState<Assignment | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);
  const [selectedFileInSubmission, setSelectedFileInSubmission] = useState<number>(0);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    class_id: '',
    title: '',
    description: '',
    due_date: '',
    starter_files: [] as StarterFile[]
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const courseId = queryParams.get('courseId');
    if (courseId) {
      setSelectedCourseId(courseId);
    }
  }, [location.search]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch Courses
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('instructor_id', session.user.id);

      if (classesError) throw classesError;
      setCourses(classesData || []);

      // Fetch Assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('*')
        .order('created_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Fetch Submissions with student profiles and linked snapshot content
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select(`
          id,
          assignment_id,
          student_id,
          score,
          feedback,
          submitted_at,
          profiles:student_id (
            display_name
          ),
          submission_snapshots (
            snapshot_id,
            file_snapshots:snapshot_id (
              file_path,
              content
            )
          )
        `);

      if (submissionsError) throw submissionsError;

      // Flatten snapshot content into a simple array per submission
      const shaped = (submissionsData || []).map((s: any) => ({
        ...s,
        snapshots: (s.submission_snapshots || []).map((ss: any) => ({
          snapshot_id: ss.snapshot_id,
          file_path: ss.file_snapshots?.file_path || '',
          content:    ss.file_snapshots?.content    || '',
        })),
      }));
      setSubmissions(shaped as any);

      // Fetch duplicate_snapshots to identify plagiarism flags
      const { data: dupsData } = await supabase
        .from('duplicate_snapshots')
        .select('class_id, file_path, student_ids');
      setDuplicates(dupsData || []);

    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (assignment: Assignment | null = null) => {
    if (assignment) {
      setEditingAssignment(assignment);
      setFormData({
        class_id: assignment.class_id,
        title: assignment.title,
        description: assignment.description || '',
        due_date: assignment.due_date ? new Date(assignment.due_date).toISOString().split('T')[0] : '',
        starter_files: [...assignment.starter_files]
      });
    } else {
      setEditingAssignment(null);
      setFormData({
        class_id: selectedCourseId !== 'all' ? selectedCourseId : (courses.length > 0 ? courses[0].id : ''),
        title: '',
        description: '',
        due_date: '',
        starter_files: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      
      const payload = {
        class_id: formData.class_id,
        title: formData.title,
        description: formData.description || null,
        due_date: formData.due_date && !isNaN(new Date(formData.due_date).getTime()) 
          ? new Date(formData.due_date).toISOString() 
          : null,
        starter_files: formData.starter_files
      };

      if (editingAssignment) {
        const { error } = await supabase
          .from('assignments')
          .update(payload)
          .eq('id', editingAssignment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('assignments')
          .insert(payload);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchInitialData();
    } catch (err) {
      console.error('Error saving assignment:', err);
      alert('Failed to save assignment.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setAssignments(assignments.filter(a => a.id !== id));
    } catch (err) {
      console.error('Error deleting assignment:', err);
      alert('Failed to delete assignment.');
    }
  };

  const addStarterFile = () => {
    setFormData({
      ...formData,
      starter_files: [...formData.starter_files, { path: '', content: '' }]
    });
  };

  const updateStarterFile = (index: number, field: keyof StarterFile, value: string) => {
    const updated = [...formData.starter_files];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, starter_files: updated });
  };

  const removeStarterFile = (index: number) => {
    setFormData({
      ...formData,
      starter_files: formData.starter_files.filter((_, i) => i !== index)
    });
  };

  const filteredAssignments = assignments.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourseId === 'all' || a.class_id === selectedCourseId;
    return matchesSearch && matchesCourse;
  });

  const getCourseName = (id: string) => {
    return courses.find(c => c.id === id)?.name || 'Unknown Course';
  };

  const getSubmissionCount = (assignmentId: string) => {
    return submissions.filter(s => s.assignment_id === assignmentId).length;
  };

  const handleViewSubmissions = (assignment: Assignment) => {
    setViewingAssignment(assignment);
    setIsSubmissionsModalOpen(true);
    setViewingSubmission(null);
  };

  const handleGradeSubmission = (submission: Submission) => {
    const assignment = assignments.find(a => a.id === submission.assignment_id) || null;
    setViewingAssignment(assignment);
    setIsSubmissionsModalOpen(true);
    setViewingSubmission(submission);
    setSelectedFileInSubmission(0);
  };

  const unscoredSubmissions = useMemo(() => {
    const filtered = submissions.filter(s => {
      if (s.score !== null) return false;
      if (selectedCourseId === 'all') return true;
      const assignment = assignments.find(a => a.id === s.assignment_id);
      return assignment?.class_id === selectedCourseId;
    });

    return filtered.map(s => {
      const assignment = assignments.find(a => a.id === s.assignment_id);
      const classId = assignment?.class_id;

      // Assignment-specific: only flag if the student has a duplicate on a file path
      // that actually exists within this submission's linked snapshots
      const flaggedFile = classId
        ? duplicates.find(d =>
            d.class_id === classId &&
            d.student_ids.includes(s.student_id) &&
            s.snapshots.some((snap: any) => snap.file_path === d.file_path)
          )
        : null;

      return {
        ...s,
        assignmentTitle: assignment?.title || 'Unknown Assignment',
        hasPlagiarismFlag: !!flaggedFile,
        flaggedFilePath: flaggedFile?.file_path,
      };
    });
  }, [submissions, assignments, selectedCourseId, duplicates]);

  if (loading) {
    return (
      <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1>Assignments</h1>
          <p>Manage coursework and starter files for your students.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="nav-item" 
          style={{ 
            background: 'var(--primary)', 
            color: 'white', 
            padding: '0.625rem 1.25rem', 
            gap: '0.5rem',
            borderRadius: 'var(--radius-md)'
          }}
        >
          <Plus size={18} />
          <span>New Assignment</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ flex: 1 }}>
          <div className="card-content" style={{ padding: '0.75rem' }}>
            <div className="header-search" style={{ border: 'none', padding: 0, width: '100%', maxWidth: 'none' }}>
              <Search size={18} className="text-muted" />
              <input 
                type="text" 
                placeholder="Search assignments..." 
                style={{ width: '100%' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        <select 
          className="card"
          style={{ 
            padding: '0 1rem', 
            borderRadius: 'var(--radius-lg)', 
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            minWidth: '200px',
            fontSize: '0.875rem',
            outline: 'none'
          }}
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
        >
          <option value="all">All Courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Needs Grading Panel */}
      {unscoredSubmissions.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid #fde68a' }}>
          <div className="card-header" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef9c3)', borderBottom: '1px solid #fde68a', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <AlertCircle size={18} color="#d97706" />
              <h3 className="card-title" style={{ color: '#92400e' }}>Needs Grading</h3>
              <span style={{
                background: '#d97706',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.15rem 0.55rem',
                borderRadius: '999px',
                lineHeight: 1.5
              }}>{unscoredSubmissions.length}</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#92400e', opacity: 0.8 }}>
              Submissions awaiting a score
            </span>
          </div>
          <div className="card-content" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Assignment</th>
                    <th>Submitted</th>
                    <th>Flags</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unscoredSubmissions.map(sub => (
                    <tr key={sub.id}>
                      <td>
                        <div className="student-cell">
                          <div className="student-avatar" style={{ background: '#d97706', color: 'white', fontSize: '0.8rem' }}>
                            {(sub.profiles?.display_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600 }}>{sub.profiles?.display_name || 'Anonymous'}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{sub.assignmentTitle}</span>
                      </td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {new Date(sub.submitted_at).toLocaleDateString([], { dateStyle: 'medium' })}
                      </td>
                      <td>
                        {sub.hasPlagiarismFlag ? (
                          <span 
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fca5a5',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '999px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              cursor: 'help'
                            }}
                            title={`Shared logic detected in: ${sub.flaggedFilePath}`}
                          >
                            <AlertCircle size={12} />
                            Plagiarism Flag
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="nav-item"
                          onClick={() => handleGradeSubmission(sub)}
                          style={{
                            background: '#d97706',
                            color: 'white',
                            padding: '0.4rem 0.9rem',
                            fontSize: '0.8rem',
                            gap: '0.35rem',
                            borderRadius: 'var(--radius-md)'
                          }}
                        >
                          <Pencil size={13} />
                          <span>Grade</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">All Submissions</h3>
        </div>
        <div className="card-content" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Submission Details</th>
                  <th>Course</th>
                  <th>Due Date</th>
                  <th>Submissions</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td style={{ maxWidth: '300px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{assignment.title}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {assignment.description || 'No description'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                        {getCourseName(assignment.class_id)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <Calendar size={14} className="text-muted" />
                        <span>{assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}</span>
                      </div>
                    </td>
                    <td>
                      <div 
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        onClick={() => handleViewSubmissions(assignment)}
                      >
                         <span className={`badge ${getSubmissionCount(assignment.id) > 0 ? 'badge-success' : 'badge-warning'}`}>
                          {getSubmissionCount(assignment.id)} Submitted
                        </span>
                        <Eye size={14} className="text-muted" />
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button 
                          className="icon-button" 
                          onClick={() => handleOpenModal(assignment)}
                          title="Edit Assignment"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="icon-button" 
                          onClick={() => handleDeleteAssignment(assignment.id)}
                          title="Delete Assignment"
                          style={{ color: 'var(--error, #ef4444)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAssignments.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <ClipboardList size={48} style={{ opacity: 0.2 }} />
                        <span>No assignments found.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ 
            maxWidth: '800px', 
            width: '100%', 
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ 
              padding: '1.25rem 1.5rem', 
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingAssignment ? 'Edit Assignment' : 'New Assignment'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="icon-button"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveAssignment} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Course</label>
                    <select 
                      required
                      style={{ 
                        width: '100%',
                        padding: '0.625rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-main)',
                        outline: 'none'
                      }}
                      value={formData.class_id}
                      onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                    >
                      <option value="" disabled>Select a course</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Due Date</label>
                    <input 
                      type="date" 
                      style={{ 
                        width: '100%',
                        padding: '0.625rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-main)',
                        outline: 'none'
                      }}
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Assignment Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Lab 1: Python Basics"
                    required
                    style={{ 
                      width: '100%',
                      padding: '0.625rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-main)',
                      outline: 'none'
                    }}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Description</label>
                  <textarea 
                    placeholder="Instructions for students..."
                    rows={3}
                    style={{ 
                      width: '100%',
                      padding: '0.625rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-main)',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'inherit'
                    }}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileCode size={18} color="var(--primary)" />
                      <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Starter Files</h3>
                    </div>
                    <button 
                      type="button" 
                      onClick={addStarterFile}
                      style={{ 
                        background: 'transparent', 
                        border: '1px dashed var(--primary)', 
                        color: 'var(--primary)',
                        padding: '0.4rem 0.8rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        cursor: 'pointer'
                      }}
                    >
                      <PlusCircle size={16} />
                      <span>Add File</span>
                    </button>
                  </div>

                  {formData.starter_files.length === 0 && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '2rem', 
                      background: 'var(--bg-main)', 
                      borderRadius: 'var(--radius-lg)',
                      border: '1px dashed var(--border-color)',
                      color: 'var(--text-muted)'
                    }}>
                      <p style={{ fontSize: '0.875rem' }}>No starter files added. Students will start with an empty workspace.</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {formData.starter_files.map((file, idx) => (
                      <div key={idx} className="card" style={{ padding: '0.75rem', background: 'var(--bg-main)' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          <input 
                            placeholder="File path (e.g. main.py)"
                            style={{ 
                              flex: 1,
                              padding: '0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-color)',
                              background: 'white',
                              fontSize: '0.875rem',
                              fontFamily: 'monospace'
                            }}
                            value={file.path}
                            onChange={(e) => updateStarterFile(idx, 'path', e.target.value)}
                          />
                          <button 
                            type="button" 
                            onClick={() => removeStarterFile(idx)}
                            className="icon-button"
                            style={{ color: 'var(--error, #ef4444)' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <textarea 
                          placeholder="File content..."
                          rows={4}
                          style={{ 
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            background: 'white',
                            fontSize: '0.8125rem',
                            fontFamily: 'monospace',
                            resize: 'vertical'
                          }}
                          value={file.content}
                          onChange={(e) => updateStarterFile(idx, 'content', e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div style={{ 
                padding: '1.25rem 1.5rem', 
                background: 'rgba(0,0,0,0.01)', 
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '1rem',
                flexShrink: 0
              }}>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="nav-item"
                  style={{ background: 'transparent', border: '1px solid var(--border-color)' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={saving || !formData.title || !formData.class_id}
                  className="nav-item"
                  style={{ 
                    background: 'var(--primary)', 
                    color: 'white',
                    opacity: (saving || !formData.title || !formData.class_id) ? 0.7 : 1,
                    cursor: (saving || !formData.title || !formData.class_id) ? 'not-allowed' : 'pointer',
                    minWidth: '120px'
                  }}
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : (editingAssignment ? 'Update Assignment' : 'Create Assignment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submissions Modal */}
      {isSubmissionsModalOpen && viewingAssignment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ 
            maxWidth: '1000px', 
            width: '100%', 
            height: '85vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ 
              padding: '1.25rem 1.5rem', 
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{viewingAssignment.title} — Submissions</h2>
                <span className="text-muted" style={{ fontSize: '0.875rem' }}>Review and score student work.</span>
              </div>
              <button onClick={() => setIsSubmissionsModalOpen(false)} className="icon-button"><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Student List */}
              <div style={{ width: '300px', borderRight: '1px solid var(--border-color)', overflowY: 'auto', background: 'rgba(0,0,0,0.01)' }}>
                {submissions.filter(s => s.assignment_id === viewingAssignment.id).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No submissions yet.
                  </div>
                ) : (
                  submissions
                    .filter(s => s.assignment_id === viewingAssignment.id)
                    .map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => {
                          setViewingSubmission(s);
                          setSelectedFileInSubmission(0);
                        }}
                        style={{ 
                          padding: '1rem', 
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          background: viewingSubmission?.id === s.id ? 'white' : 'transparent',
                          borderLeft: viewingSubmission?.id === s.id ? '4px solid var(--primary)' : '4px solid transparent',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{s.profiles?.display_name || 'Anonymous'}</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(s.submitted_at).toLocaleDateString()}
                          </span>
                          {s.score !== null ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Score: {s.score}</span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unscored</span>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Submission Viewer */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {viewingSubmission ? (
                  <>
                    {/* Controls/Files */}
                    <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'white' }}>
                       <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        {viewingSubmission.snapshots.map((file, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedFileInSubmission(idx)}
                            style={{
                              padding: '0.4rem 0.8rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid',
                              borderColor: selectedFileInSubmission === idx ? 'var(--primary)' : 'var(--border-color)',
                              background: selectedFileInSubmission === idx ? 'rgba(var(--primary-rgb, 59, 130, 246), 0.1)' : 'white',
                              color: selectedFileInSubmission === idx ? 'var(--primary)' : 'var(--text-main)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              cursor: 'pointer'
                            }}
                          >
                            {file.file_path.split('/').pop()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Code Viewer */}
                    <div style={{ flex: 1, background: '#1e1e1e', overflowY: 'auto', padding: '1.5rem', fontFamily: 'monospace', fontSize: '13px', color: '#d4d4d4', whiteSpace: 'pre-wrap' }}>
                      {viewingSubmission.snapshots[selectedFileInSubmission]?.content}
                    </div>

                    {/* Grading Footer */}
                    <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'white', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                       <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.4rem' }}>Feedback</label>
                        <textarea 
                          placeholder="Provide feedback to the student..."
                          rows={1}
                          style={{ 
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-main)',
                            fontSize: '0.875rem',
                            resize: 'none'
                          }}
                          value={viewingSubmission.feedback || ''}
                          onChange={async (e) => {
                             const val = e.target.value;
                             const updated = {...viewingSubmission, feedback: val};
                             setViewingSubmission(updated);
                             setSubmissions(submissions.map(sub => sub.id === updated.id ? updated : sub));
                             
                             // Debounced or simple update
                             await supabase.from('submissions').update({ feedback: val }).eq('id', updated.id);
                          }}
                        />
                      </div>
                      <div style={{ width: '100px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.4rem' }}>Score</label>
                        <input 
                          type="number"
                          placeholder="0-100"
                          style={{ 
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-main)',
                            fontSize: '0.875rem'
                          }}
                          value={viewingSubmission.score === null ? '' : viewingSubmission.score}
                          onChange={async (e) => {
                             const val = e.target.value === '' ? null : Number(e.target.value);
                             const updated = {...viewingSubmission, score: val};
                             setViewingSubmission(updated);
                             setSubmissions(submissions.map(sub => sub.id === updated.id ? updated : sub));
                             
                             await supabase.from('submissions').update({ score: val }).eq('id', updated.id);
                          }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '1rem' }}>
                    <ClipboardList size={64} style={{ opacity: 0.1 }} />
                    <p>Select a student to view their submission.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Assignments;
