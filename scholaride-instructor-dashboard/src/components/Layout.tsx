import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  ClipboardList, 
  Settings, 
  Search, 
  Bell, 
  LogOut,
  Calendar,
  MessageSquare,
  Loader2
} from 'lucide-react';

const Layout: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
      }
      setLoading(false);
    }
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { id: 'courses', label: 'Courses', icon: <BookOpen size={20} />, path: '/courses' },
    { id: 'students', label: 'Students', icon: <Users size={20} />, path: '/students' },
    { id: 'assignments', label: 'Assignments', icon: <ClipboardList size={20} />, path: '/assignments' },
    { id: 'schedule', label: 'Schedule', icon: <Calendar size={20} />, path: '/schedule' },
    { id: 'messages', label: 'Messages', icon: <MessageSquare size={20} />, path: '/messages' },
  ];

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="avatar" style={{ backgroundColor: 'white', color: 'var(--primary)' }}>S</div>
          <span>ScholarIDE</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <div 
              key={item.id}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="nav-item">
            <Settings size={20} />
            <span>Settings</span>
          </div>
          <div className="nav-item" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Logout</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-wrapper">
        <header className="header">
          <div className="header-search">
            <Search size={18} className="text-muted" />
            <input type="text" placeholder="Search for students, courses, or files..." />
          </div>

          <div className="header-actions">
            <button className="icon-button">
              <Bell size={20} />
            </button>
            <div className="user-profile">
              <div className="avatar">{user?.email?.substring(0, 2).toUpperCase()}</div>
              <div className="user-info hide-mobile">
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user?.email?.split('@')[0]}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Instructor Account</div>
              </div>
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
