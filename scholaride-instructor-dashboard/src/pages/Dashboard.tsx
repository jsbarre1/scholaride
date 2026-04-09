import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Users,
  BookOpen,
  ClipboardList,
  ChevronRight, 
  MoreVertical,
  TrendingUp,
  Clock,
  Loader2
} from 'lucide-react'
import '../App.css'

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState([
    { label: 'Total Students', value: '0', trend: '0%', trendUp: true, icon: <Users size={20} />, iconBg: '#eef2ff', iconColor: '#6366f1' },
    { label: 'Active Courses', value: '0', trend: '0%', trendUp: true, icon: <BookOpen size={20} />, iconBg: '#fff7ed', iconColor: '#f97316' },
    { label: 'Total Snapshots', value: '0', trend: '0%', trendUp: true, icon: <ClipboardList size={20} />, iconBg: '#f0fdf4', iconColor: '#22c55e' },
    { label: 'Integrity Alerts', value: '0', trend: '0%', trendUp: false, icon: <TrendingUp size={20} />, iconBg: '#fef2f2', iconColor: '#ef4444' },
  ])

  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await fetchData(session.user.id)
      } else {
        setLoading(false)
      }
    }
    init()
  }, [])

  async function fetchData(instructorId: string) {
    try {
      setLoading(true)
      
      // 1. Fetch Classes for this instructor
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('instructor_id', instructorId)

      if (classesError) throw classesError

      const classIds = classes?.map(c => c.id) || []

      if (classIds.length === 0) {
        setLoading(false);
        return;
      }

      // 2. Fetch Total Students (Enrollments in those classes)
      const { count: studentCount, error: enrollError } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .in('class_id', classIds)
      
      if (enrollError) console.error("Enrollment fetch error:", enrollError)

      // 3. Fetch Total Snapshots
      const { count: snapshotCount, error: snapshotError } = await supabase
        .from('file_snapshots')
        .select('*', { count: 'exact', head: true })
        .in('class_id', classIds)

      if (snapshotError) console.error("Snapshot count error:", snapshotError)

      // 4. Fetch Recent Submissions / Snapshots with Student Info
      const { data: snapshots, error: fetchSnapshotsError } = await supabase
        .from('file_snapshots')
        .select(`
          id, 
          file_path, 
          saved_at, 
          class_id,
          classes (name),
          profiles!user_id (display_name)
        `)
        .in('class_id', classIds)
        .order('saved_at', { ascending: false })
        .limit(5)

      if (fetchSnapshotsError) console.error("Snapshots fetch error:", fetchSnapshotsError)

      // 5. Update Stats
      setStats(prev => [
        { ...prev[0], value: (studentCount || 0).toString() },
        { ...prev[1], value: (classes?.length || 0).toString() },
        { ...prev[2], value: (snapshotCount || 0).toString() },
        { ...prev[3], value: '0' },
      ])

      // 6. Update Submissions
      if (snapshots) {
        setRecentSubmissions(snapshots.map(s => ({
          id: s.id,
          student: (s as any).profiles?.display_name || 'Unknown Student',
          assignment: s.file_path.split('/').pop(),
          course: (s as any).classes?.name || 'Unknown Course',
          date: new Date(s.saved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'Synced',
          grade: '-'
        })))
      }

      // 7. Mock Activities
      if (snapshots) {
        setActivities(snapshots.slice(0, 4).map(s => ({
          id: s.id,
          type: 'submission',
          title: `New snapshot: ${s.file_path.split('/').pop()}`,
          time: new Date(s.saved_at).toLocaleTimeString(),
          color: '#6366f1'
        })))
      }

    } catch (err) {
      console.error("Error fetching dashboard data:", err)
    } finally {
      setLoading(false)
    }
  }


  if (loading) {
    return (
      <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <h1>Instructor Dashboard</h1>
        <p>Welcome back! Here's what's happening in your classes.</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-header">
              <div className="stat-icon" style={{ backgroundColor: stat.iconBg, color: stat.iconColor }}>
                {stat.icon}
              </div>
              <button className="icon-button" style={{ width: '24px', height: '24px' }}>
                <MoreVertical size={16} />
              </button>
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
            <div className={`stat-trend ${stat.trendUp ? 'trend-up' : 'trend-down'}`}>
              {stat.trendUp ? '↑' : '↓'} {stat.trend} <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>since last month</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        {/* Recent Submissions */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Snapshots</h3>
            <button className="nav-item" style={{ padding: '0.5rem', background: 'transparent' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--primary)', fontWeight: 500 }}>View all</span>
              <ChevronRight size={16} color="var(--primary)" />
            </button>
          </div>
          <div className="card-content">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>File</th>
                    <th>Status</th>
                    <th>Grade</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubmissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <div className="student-cell">
                          <div className="student-avatar">{sub.student.split(' ').map((n: string) => n[0]).join('')}</div>
                          <span>{sub.student}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{sub.assignment}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub.course}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${sub.status === 'Synced' ? 'badge-success' : 'badge-warning'}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{sub.grade}</td>
                      <td>{sub.date}</td>
                    </tr>
                  ))}
                  {recentSubmissions.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No recent snapshots found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Activity</h3>
            <button className="icon-button">
              <MoreVertical size={18} />
            </button>
          </div>
          <div className="card-content">
            <div className="activity-feed">
              {activities.map((act) => (
                <div key={act.id} className="activity-item">
                  <div className="activity-dot" style={{ backgroundColor: act.color }}></div>
                  <div className="activity-content">
                    <div className="activity-title">{act.title}</div>
                    <div className="activity-time">
                      <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      {act.time}
                    </div>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                 <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                   No recent activity.
                 </div>
              )}
            </div>
            <button className="nav-item" style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem', border: '1px solid var(--border-color)', background: 'transparent' }}>
              Refresh Feed
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
