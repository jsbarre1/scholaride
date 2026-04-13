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

interface Course {
  id: string;
  name: string;
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
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
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

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">All Assignments</h3>
        </div>
        <div className="card-content" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Assignment Details</th>
                  <th>Course</th>
                  <th>Due Date</th>
                  <th>Starter Files</th>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <FileCode size={14} className="text-muted" />
                        <span>{assignment.starter_files.length} Files</span>
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
    </>
  );
};

export default Assignments;
