import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ShieldAlert, 
  Search, 
  Eye, 
  AlertTriangle,
  Loader2,
  X,
  User,
  Clock,
  Code
} from 'lucide-react';

interface DuplicateSnapshot {
  semantic_hash: string;
  class_id: string;
  file_path: string;
  student_count: number;
  student_ids: string[];
  last_seen: string;
}

interface StudentProfile {
  id: string;
  display_name: string;
}

interface Course {
  id: string;
  name: string;
}

interface SnapshotDetail {
    user_id: string;
    saved_at: string;
}

const Integrity: React.FC = () => {
  const [duplicates, setDuplicates] = useState<DuplicateSnapshot[]>([]);
  const [profiles, setProfiles] = useState<Record<string, StudentProfile>>({});
  const [courses, setCourses] = useState<Record<string, Course>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  
  // Modal State
  const [selectedIncident, setSelectedIncident] = useState<DuplicateSnapshot | null>(null);
  const [incidentContent, setIncidentContent] = useState<string>('');
  const [incidentSnapshots, setIncidentSnapshots] = useState<SnapshotDetail[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: dupsData, error: dupsError } = await supabase
        .from('duplicate_snapshots')
        .select('*');

      if (dupsError) throw dupsError;
      setDuplicates(dupsData || []);

      const studentIds = Array.from(new Set((dupsData || []).flatMap(d => d.student_ids)));
      if (studentIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', studentIds);
        
        if (profilesError) throw profilesError;
        const profileMap: Record<string, StudentProfile> = {};
        profilesData?.forEach(p => profileMap[p.id] = p);
        setProfiles(profileMap);
      }

      const { data: coursesData, error: coursesError } = await supabase
        .from('classes')
        .select('id, name');
      
      if (coursesError) throw coursesError;
      const courseMap: Record<string, Course> = {};
      coursesData?.forEach(c => courseMap[c.id] = c);
      setCourses(courseMap);

    } catch (e) {
      console.error("Error fetching integrity data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (incident: DuplicateSnapshot) => {
    setSelectedIncident(incident);
    setModalLoading(true);
    try {
        // Fetch content (only once since it's identical semantically)
        const { data: contentData } = await supabase
            .from('file_snapshots')
            .select('content')
            .eq('nowhitespace_hash', incident.semantic_hash)
            .limit(1)
            .single();
        
        setIncidentContent(contentData?.content || '');

        // Fetch list of appearances with student and time
        const { data: snapshotsData } = await supabase
            .from('file_snapshots')
            .select('user_id, saved_at')
            .eq('nowhitespace_hash', incident.semantic_hash)
            .eq('class_id', incident.class_id)
            .order('saved_at', { ascending: false });
        
        setIncidentSnapshots(snapshotsData || []);
    } catch (e) {
        console.error("Error fetching incident details:", e);
    } finally {
        setModalLoading(false);
    }
  };

  const filteredDuplicates = duplicates.filter(d => {
    const matchesSearch = d.file_path.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourseId === 'all' || d.class_id === selectedCourseId;
    return matchesSearch && matchesCourse;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
      </div>
    );
  }

  return (
    <div className="page-header" style={{ display: 'block' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 className="page-title">Plagiarism Detection</h2>
        <p className="page-subtitle">Identify identical snapshots submitted by different students.</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ flex: 1 }}>
          <div className="card-content" style={{ padding: '0.75rem' }}>
            <div className="header-search" style={{ border: 'none', padding: 0, width: '100%', maxWidth: 'none' }}>
              <Search size={18} className="text-muted" />
              <input 
                type="text" 
                placeholder="Search by file path..." 
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
          {Object.values(courses).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {filteredDuplicates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <ShieldAlert size={48} style={{ margin: '0 auto 1.5rem', color: 'var(--success)', opacity: 0.5 }} />
          <h3>No Duplicate Snapshots Found</h3>
          <p className="text-muted">No instances of identical code snapshots across multiple students detected.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Detected Incidents</h3>
          </div>
          <div className="card-content" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>File Path & Course</th>
                    <th>Students</th>
                    <th>Last Saved</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDuplicates.map((dup, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: 'var(--radius-md)', 
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--error)'
                          }}>
                            <AlertTriangle size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{dup.file_path}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {courses[dup.class_id]?.name || 'Unknown Course'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span className="badge badge-error" style={{ width: 'fit-content' }}>
                            {dup.student_count} Students Identical
                          </span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {dup.student_ids.map(id => profiles[id]?.display_name || 'Unknown').join(', ')}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.875rem' }}>
                          {new Date(dup.last_seen).toLocaleString()}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                         <button 
                            className="nav-item focusable" 
                            style={{ 
                                padding: '0.5rem 1rem', 
                                background: 'transparent', 
                                border: '1px solid var(--border-color)',
                                fontSize: '0.8125rem'
                            }}
                            onClick={() => handleViewDetails(dup)}
                         >
                            <Eye size={14} className="mr-2" />
                            <span>View Details</span>
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

      {/* Incident Details Modal */}
      {selectedIncident && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div className="card" style={{ 
            width: '100%', 
            maxWidth: '1200px', 
            maxHeight: '90vh', 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={20} className="text-error" />
                    Plagiarism Investigation
                </h3>
                <p className="card-subtitle">{selectedIncident.file_path} in {courses[selectedIncident.class_id]?.name}</p>
              </div>
              <button 
                onClick={() => setSelectedIncident(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="card-content" style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: '1.5rem', padding: '1.5rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    <Code size={16} />
                    <span>Identical Code Content</span>
                </div>
                <div style={{ 
                    flex: 1, 
                    backgroundColor: '#1e1e1e', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '1rem',
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: '#ddd',
                    whiteSpace: 'pre-wrap',
                    border: '1px solid #333'
                }}>
                  {modalLoading ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <Loader2 className="animate-spin" size={24} />
                    </div>
                  ) : (
                    incidentContent || 'No content found.'
                  )}
                </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        <AlertTriangle size={14} />
                        <span>Semantic Logic Fingerprint</span>
                    </div>
                    <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedIncident.semantic_hash}</code>
              </div>

              <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    <User size={16} />
                    <span>Involved Students</span>
                </div>
                <div style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.75rem',
                    overflowY: 'auto'
                }}>
                  {modalLoading ? (
                     <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <Loader2 className="animate-spin" size={24} />
                     </div>
                  ) : (
                    incidentSnapshots.map((snap, i) => (
                        <div key={i} className="card" style={{ padding: '1rem', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                <div style={{ 
                                    width: '32px', 
                                    height: '32px', 
                                    borderRadius: '50%', 
                                    background: 'var(--primary)', 
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                }}>
                                    {profiles[snap.user_id]?.display_name?.substring(0, 2).toUpperCase() || '??'}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{profiles[snap.user_id]?.display_name || 'Unknown Student'}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{snap.user_id}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <Clock size={12} />
                                <span>Saved at: {new Date(snap.saved_at).toLocaleString()}</span>
                            </div>
                        </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="card-footer" style={{ justifyContent: 'flex-end', gap: '1rem' }}>
                <button 
                   onClick={() => setSelectedIncident(null)}
                   style={{ 
                        padding: '0.5rem 1.5rem', 
                        borderRadius: 'var(--radius-md)', 
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        cursor: 'pointer'
                   }}
                >
                    Close
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Integrity;
