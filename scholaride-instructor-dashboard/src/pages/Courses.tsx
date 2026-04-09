import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  BookOpen, 
  Users, 
  MoreVertical, 
  Plus, 
  Search,
  ChevronRight,
  Calendar,
  Loader2,
  Copy,
  Check,
  X
} from 'lucide-react';

interface Course {
  id: string;
  name: string;
  description: string;
  join_code: string;
  created_at: string;
  student_count: number;
}

const Courses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from('classes')
        .insert({
          name: newCourseName,
          description: newCourseDescription,
          instructor_id: session.user.id
        });

      if (error) throw error;

      // Reset and refresh
      setIsModalOpen(false);
      setNewCourseName('');
      setNewCourseDescription('');
      fetchCourses();
    } catch (err) {
      console.error('Error creating course:', err);
      alert('Failed to create course. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch classes
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select(`
          *,
          enrollments (count)
        `)
        .eq('instructor_id', session.user.id)
        .order('created_at', { ascending: false });

      if (classesError) throw classesError;

      const formattedCourses = (classes || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        join_code: c.join_code,
        created_at: c.created_at,
        student_count: c.enrollments?.[0]?.count || 0
      }));

      setCourses(formattedCourses);
    } catch (err) {
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredCourses = courses.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>My Courses</h1>
          <p>You have {courses.length} active courses in ScholarIDE.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
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
          <span>Create New Course</span>
        </button>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-content" style={{ padding: '1rem' }}>
          <div className="header-search" style={{ border: 'none', padding: 0, width: '100%', maxWidth: 'none' }}>
            <Search size={18} className="text-muted" />
            <input 
              type="text" 
              placeholder="Filter courses by name or description..." 
              style={{ width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
        gap: '1.5rem' 
      }}>
        {filteredCourses.map((course) => (
          <div key={course.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ alignItems: 'flex-start' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                background: '#eef2ff', 
                color: '#6366f1', 
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <BookOpen size={24} />
              </div>
              <div className="dropdown">
                <button className="icon-button">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>
            
            <div className="card-content" style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>{course.name}</h3>
              <p style={{ 
                fontSize: '0.875rem', 
                color: 'var(--text-muted)', 
                marginBottom: '1.5rem',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.5
              }}>
                {course.description || 'No description provided for this course.'}
              </p>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <Users size={16} color="var(--text-muted)" />
                  <span><strong>{course.student_count}</strong> Students</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <Calendar size={16} color="var(--text-muted)" />
                  <span>{new Date(course.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div style={{ 
                background: 'var(--bg-main)', 
                padding: '0.75rem', 
                borderRadius: 'var(--radius-md)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                border: '1px dashed var(--border-color)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Join Code</span>
                  <span style={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)', letterSpacing: '0.1em' }}>{course.join_code}</span>
                </div>
                <button 
                  onClick={() => copyToClipboard(course.join_code)}
                  className="icon-button"
                  style={{ color: copiedCode === course.join_code ? '#22c55e' : 'var(--text-muted)' }}
                  title="Copy join code"
                >
                  {copiedCode === course.join_code ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            <div style={{ 
              padding: '1rem', 
              borderTop: '1px solid var(--border-color)', 
              display: 'flex', 
              justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.01)'
            }}>
              <button className="nav-item" style={{ padding: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)', background: 'transparent' }}>
                View Roster
              </button>
              <button 
                onClick={() => navigate(`/courses/${course.id}`)}
                className="nav-item" 
                style={{ 
                  padding: '0.5rem', 
                  fontSize: '0.875rem', 
                  color: 'var(--primary)', 
                  fontWeight: 600,
                  background: 'transparent'
                }}
              >
                <span>Go to course</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ))}

        {filteredCourses.length === 0 && (
          <div style={{ 
            gridColumn: '1 / -1', 
            background: 'var(--bg-card)', 
            padding: '4rem 2rem', 
            textAlign: 'center', 
            borderRadius: 'var(--radius-xl)',
            border: '2px dashed var(--border-color)'
          }}>
            <BookOpen size={48} color="var(--border-color)" style={{ margin: '0 auto 1.5rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No courses found</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              {searchQuery ? `No courses match your search "${searchQuery}"` : "You haven't created any courses yet."}
            </p>
            {!searchQuery && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="nav-item" 
                style={{ 
                  background: 'var(--primary)', 
                  color: 'white', 
                  margin: '0 auto',
                  padding: '0.625rem 1.25rem', 
                  gap: '0.5rem',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <Plus size={18} />
                <span>Create your first course</span>
              </button>
            )}
          </div>
        )}
      </div>
      {/* Create Course Modal */}
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
            maxWidth: '500px', 
            width: '100%', 
            padding: 0,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ 
              padding: '1.5rem', 
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Create New Course</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="icon-button"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateCourse}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Course Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. CS101: Introduction to Programming"
                    required
                    style={{ 
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-main)',
                      outline: 'none'
                    }}
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Description</label>
                  <textarea 
                    placeholder="Briefly describe what this course covers..."
                    rows={4}
                    style={{ 
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-main)',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'inherit'
                    }}
                    value={newCourseDescription}
                    onChange={(e) => setNewCourseDescription(e.target.value)}
                  />
                </div>
              </div>
              
              <div style={{ 
                padding: '1.5rem', 
                background: 'rgba(0,0,0,0.01)', 
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '1rem',
                borderBottomLeftRadius: 'var(--radius-xl)',
                borderBottomRightRadius: 'var(--radius-xl)'
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
                  disabled={creating || !newCourseName}
                  className="nav-item"
                  style={{ 
                    background: 'var(--primary)', 
                    color: 'white',
                    opacity: (creating || !newCourseName) ? 0.7 : 1,
                    cursor: (creating || !newCourseName) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {creating ? <Loader2 className="animate-spin" size={18} /> : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Courses;
