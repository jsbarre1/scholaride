import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  Search, 
  MoreVertical, 
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  BookOpen
} from 'lucide-react';

interface Student {
  id: string;
  display_name: string;
  email?: string;
  enrolled_at: string;
  snapshot_count: number;
  last_active: string | null;
  class_id: string;
}

interface ClassGroup {
  id: string;
  name: string;
  students: Student[];
  isExpanded: boolean;
}

const Students: React.FC = () => {
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Fetch all classes for this instructor
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('instructor_id', session.user.id);

      if (classesError) throw classesError;
      if (!classes || classes.length === 0) {
        setClassGroups([]);
        setLoading(false);
        return;
      }

      const classIds = classes.map(c => c.id);

      // 2. Fetch all enrollments for these classes
      const { data: enrollmentData, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
          enrolled_at,
          class_id,
          profiles:student_id (
            id,
            display_name
          )
        `)
        .in('class_id', classIds);

      if (enrollError) throw enrollError;

      // 3. Fetch snapshots for these classes to get counts and activity
      const { data: snapshotData, error: snapError } = await supabase
        .from('file_snapshots')
        .select('user_id, class_id, saved_at')
        .in('class_id', classIds);

      if (snapError) throw snapError;

      // Map snapshots to student+class
      const statsMap: Record<string, { count: number, latest: string | null }> = {};
      snapshotData?.forEach(s => {
        const key = `${s.user_id}_${s.class_id}`;
        if (!statsMap[key]) statsMap[key] = { count: 0, latest: null };
        statsMap[key].count++;
        if (!statsMap[key].latest || s.saved_at > statsMap[key].latest!) {
          statsMap[key].latest = s.saved_at;
        }
      });

      // 4. Group students by class
      const groups: ClassGroup[] = classes.map(c => {
        const classStudents = (enrollmentData || [])
          .filter(e => e.class_id === c.id)
          .map((e: any) => {
            const stats = statsMap[`${e.profiles.id}_${c.id}`];
            return {
              id: e.profiles.id,
              display_name: e.profiles.display_name || 'Anonymous Student',
              enrolled_at: e.enrolled_at,
              snapshot_count: stats?.count || 0,
              last_active: stats?.latest || null,
              class_id: c.id
            };
          });

        return {
          id: c.id,
          name: c.name,
          students: classStudents,
          isExpanded: true // Default to expanded
        };
      });

      setClassGroups(groups);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (classId: string) => {
    setClassGroups(prev => prev.map(group => 
      group.id === classId ? { ...group, isExpanded: !group.isExpanded } : group
    ));
  };

  const filteredGroups = classGroups.map(group => ({
    ...group,
    students: group.students.filter(s => 
      s.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(group => group.students.length > 0 || (searchQuery === '' && group.students.length === 0));

  if (loading) {
    return (
      <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Students</h1>
        <p>Manage and track all students across your active courses.</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-content" style={{ padding: '1.25rem' }}>
          <div className="header-search" style={{ border: 'none', padding: 0, width: '100%', maxWidth: 'none' }}>
            <Search size={18} className="text-muted" />
            <input 
              type="text" 
              placeholder="Search students across all classes..." 
              style={{ width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div style={{ 
          background: 'var(--bg-card)', 
          padding: '4rem 2rem', 
          textAlign: 'center', 
          borderRadius: 'var(--radius-xl)',
          border: '2px dashed var(--border-color)'
        }}>
          <Users size={48} color="var(--border-color)" style={{ margin: '0 auto 1.5rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No students found</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            {searchQuery ? `No students match your search "${searchQuery}"` : "You don't have any students enrolled in your classes yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {filteredGroups.map(group => (
            <div key={group.id} className="card">
              <div 
                className="card-header" 
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleGroup(group.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {group.isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    background: 'var(--primary-light)', 
                    color: 'var(--primary)', 
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h3 className="card-title">{group.name}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{group.students.length} Students</p>
                  </div>
                </div>
              </div>

              {group.isExpanded && (
                <div className="card-content" style={{ padding: 0 }}>
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
                        {group.students.map((student) => (
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
                        {group.students.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No students enrolled in this class.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default Students;
