import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  ArrowLeft, 
  Search, 
  MoreVertical, 
  Loader2,
  ExternalLink
} from 'lucide-react';

interface Student {
  id: string;
  display_name: string;
  enrolled_at: string;
  snapshot_count: number;
  last_active: string | null;
}

interface CourseInfo {
  id: string;
  name: string;
  join_code: string;
}

const CourseDetails: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Course Info
      const { data: course, error: courseError } = await supabase
        .from('classes')
        .select('id, name, join_code')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      setCourseInfo(course);

      // 2. Fetch Students
      const { data: enrollmentData, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
          enrolled_at,
          profiles:student_id (
            id,
            display_name
          )
        `)
        .eq('class_id', courseId);

      if (enrollError) throw enrollError;

      // 3. Fetch Snapshot Counts and Last Active Time per Student
      const { data: snapshotData, error: snapError } = await supabase
        .from('file_snapshots')
        .select('user_id, saved_at')
        .eq('class_id', courseId);

      if (snapError) throw snapError;

      // Group counts and find latest activity
      const statsMap: Record<string, { count: number, latest: string | null }> = {};
      snapshotData?.forEach(s => {
        if (!statsMap[s.user_id]) statsMap[s.user_id] = { count: 0, latest: null };
        statsMap[s.user_id].count++;
        if (!statsMap[s.user_id].latest || s.saved_at > statsMap[s.user_id].latest!) {
          statsMap[s.user_id].latest = s.saved_at;
        }
      });

      const formattedStudents = (enrollmentData || []).map((e: any) => ({
        id: e.profiles.id,
        display_name: e.profiles.display_name || 'Anonymous Student',
        enrolled_at: e.enrolled_at,
        snapshot_count: statsMap[e.profiles.id]?.count || 0,
        last_active: statsMap[e.profiles.id]?.latest || null
      }));

      setStudents(formattedStudents);
    } catch (err) {
      console.error('Error fetching roster:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  if (!courseInfo) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>Course not found</h2>
        <button onClick={() => navigate('/courses')} className="nav-item">Back to Courses</button>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <button 
          onClick={() => navigate('/courses')}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            color: 'var(--text-muted)', 
            marginBottom: '1rem',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Courses</span>
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1>{courseInfo.name}</h1>
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={16} />
              <span>{students.length} Students Enrolled</span>
              <span className="text-muted">•</span>
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Join Code: {courseInfo.join_code}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={() => navigate(`/assignments?courseId=${courseInfo.id}`)}
              className="nav-item" 
              style={{ background: 'transparent', border: '1px solid var(--border-color)' }}
            >
              Manage Assignments
            </button>
            <button className="nav-item" style={{ background: 'var(--primary)', color: 'white' }}>
              Export Roster
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-content" style={{ padding: '1.25rem' }}>
          <div className="header-search" style={{ border: 'none', padding: 0, width: '100%', maxWidth: 'none' }}>
            <Search size={18} className="text-muted" />
            <input 
              type="text" 
              placeholder="Search students in this roster..." 
              style={{ width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Student Roster</h3>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>Full record of students currently enrolled in this course.</p>
        </div>
        <div className="card-content">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Join Date</th>
                  <th>Last Active</th>
                  <th>Snapshots</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="student-cell">
                        <div className="student-avatar" style={{ background: 'var(--primary)', color: 'white' }}>
                          {student.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{student.display_name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {student.id.substring(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td>{new Date(student.enrolled_at).toLocaleDateString()}</td>
                    <td>{student.last_active ? new Date(student.last_active).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}</td>
                    <td>
                      <span className={`badge ${student.snapshot_count > 0 ? 'badge-success' : 'badge-warning'}`}>
                        {student.snapshot_count} Synced
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button className="icon-button" title="View Progress">
                          <ExternalLink size={16} />
                        </button>
                        <button className="icon-button">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      {searchQuery ? `No students found matching "${searchQuery}"` : 'No students have joined this course yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default CourseDetails;
