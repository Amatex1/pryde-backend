import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import './Admin.css';

function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadTabData();
    }
  }, [activeTab, currentUser]);

  const checkAdminAccess = async () => {
    try {
      const user = getCurrentUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Try to fetch stats to verify admin access
      const response = await api.get('/admin/stats');
      setCurrentUser(user);
      setStats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Admin access denied:', error);
      console.error('Error details:', error.response?.data || error.message);

      if (error.response?.status === 403) {
        setError('Access denied. You need admin privileges to access this page.');
      } else if (error.response?.status === 404) {
        setError('Admin routes not found. Please make sure the backend is updated and deployed.');
      } else if (error.message === 'Network Error') {
        setError('Cannot connect to server. Please check if the backend is running.');
      } else {
        setError(`Error: ${error.response?.data?.message || error.message}`);
      }

      setLoading(false);
      setTimeout(() => navigate('/'), 5000);
    }
  };

  const loadTabData = async () => {
    try {
      if (activeTab === 'dashboard') {
        const response = await api.get('/admin/stats');
        setStats(response.data);
      } else if (activeTab === 'reports') {
        const response = await api.get('/admin/reports?status=pending');
        setReports(response.data.reports);
      } else if (activeTab === 'users') {
        const response = await api.get('/admin/users');
        console.log('Users data:', response.data.users);
        setUsers(response.data.users);
      } else if (activeTab === 'blocks') {
        const response = await api.get('/admin/blocks');
        setBlocks(response.data.blocks);
      } else if (activeTab === 'activity') {
        const response = await api.get('/admin/activity?days=7');
        setActivity(response.data);
      }
    } catch (error) {
      console.error('Load data error:', error);
      setError('Failed to load data');
    }
  };

  const handleResolveReport = async (reportId, status, action) => {
    try {
      await api.put(`/admin/reports/${reportId}`, {
        status,
        action,
        reviewNotes: `Reviewed by admin`
      });
      alert('Report updated successfully');
      loadTabData();
    } catch (error) {
      console.error('Resolve report error:', error);
      alert('Failed to update report');
    }
  };

  const handleSuspendUser = async (userId) => {
    const days = prompt('Suspend for how many days?', '7');
    if (!days) return;

    const reason = prompt('Reason for suspension:', 'Violation of Terms of Service');
    if (!reason) return;

    try {
      await api.put(`/admin/users/${userId}/suspend`, { days: parseInt(days), reason });
      alert('User suspended successfully');
      loadTabData();
    } catch (error) {
      console.error('Suspend user error:', error);
      alert(error.response?.data?.message || 'Failed to suspend user');
    }
  };

  const handleBanUser = async (userId) => {
    if (!window.confirm('Are you sure you want to permanently ban this user?')) return;

    const reason = prompt('Reason for ban:', 'Severe violation of Terms of Service');
    if (!reason) return;

    try {
      await api.put(`/admin/users/${userId}/ban`, { reason });
      alert('User banned successfully');
      loadTabData();
    } catch (error) {
      console.error('Ban user error:', error);
      alert(error.response?.data?.message || 'Failed to ban user');
    }
  };

  const handleUnsuspendUser = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/unsuspend`);
      alert('User unsuspended successfully');
      loadTabData();
    } catch (error) {
      console.error('Unsuspend user error:', error);
      alert('Failed to unsuspend user');
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/unban`);
      alert('User unbanned successfully');
      loadTabData();
    } catch (error) {
      console.error('Unban user error:', error);
      alert('Failed to unban user');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="admin-loading">🔒 Verifying admin access...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="admin-error">
          <h2>⛔ {error}</h2>
          <p>Redirecting to home...</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="admin-container">
          <div className="admin-header">
            <h1>🛡️ Admin Panel</h1>
            <p className="admin-subtitle">Verifying admin access...</p>
          </div>
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="loading-spinner" style={{
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #6C5CE7',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }}></div>
            <p style={{ marginTop: '1rem', color: '#616161' }}>Loading admin panel...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="admin-container">
          <div className="admin-header">
            <h1>🛡️ Admin Panel</h1>
            <p className="admin-subtitle">Access Denied</p>
          </div>
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            background: '#fff3cd',
            borderRadius: '12px',
            margin: '2rem 0',
            border: '2px solid #ffc107'
          }}>
            <h2 style={{ color: '#856404', marginBottom: '1rem' }}>⚠️ {error}</h2>
            <p style={{ color: '#856404', marginBottom: '1rem' }}>
              Redirecting to home page in 5 seconds...
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#6C5CE7',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Go to Home Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />
      <div className="admin-container">
        <div className="admin-header">
          <h1>🛡️ Admin Panel</h1>
          <p className="admin-subtitle">Platform Management & Moderation</p>
        </div>

        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={`admin-tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            🚩 Reports
          </button>
          <button
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Users
          </button>
          <button
            className={`admin-tab ${activeTab === 'blocks' ? 'active' : ''}`}
            onClick={() => setActiveTab('blocks')}
          >
            🚫 Blocks
          </button>
          <button
            className={`admin-tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            📈 Activity
          </button>
        </div>

        <div className="admin-content">
          {activeTab === 'dashboard' && stats && (
            <DashboardTab stats={stats} />
          )}
          {activeTab === 'reports' && (
            <ReportsTab reports={reports} onResolve={handleResolveReport} />
          )}
          {activeTab === 'users' && (
            <UsersTab
              users={users}
              onSuspend={handleSuspendUser}
              onBan={handleBanUser}
              onUnsuspend={handleUnsuspendUser}
              onUnban={handleUnbanUser}
            />
          )}
          {activeTab === 'blocks' && (
            <BlocksTab blocks={blocks} />
          )}
          {activeTab === 'activity' && activity && (
            <ActivityTab activity={activity} />
          )}
        </div>
      </div>
    </div>
  );
}

// Dashboard Tab Component
function DashboardTab({ stats }) {
  return (
    <div className="dashboard-grid">
      <div className="stat-card">
        <h3>👥 Users</h3>
        <div className="stat-number">{stats.users.total}</div>
        <div className="stat-details">
          <span>✅ Active: {stats.users.active}</span>
          <span>⏸️ Suspended: {stats.users.suspended}</span>
          <span>🚫 Banned: {stats.users.banned}</span>
          <span>🆕 New this week: {stats.users.newThisWeek}</span>
          <span>📱 Active today: {stats.users.activeToday}</span>
        </div>
      </div>

      <div className="stat-card">
        <h3>📝 Content</h3>
        <div className="stat-number">{stats.content.totalPosts}</div>
        <div className="stat-details">
          <span>Posts: {stats.content.totalPosts}</span>
          <span>Messages: {stats.content.totalMessages}</span>
        </div>
      </div>

      <div className="stat-card">
        <h3>🛡️ Moderation</h3>
        <div className="stat-number">{stats.moderation.pendingReports}</div>
        <div className="stat-details">
          <span>⏳ Pending: {stats.moderation.pendingReports}</span>
          <span>📋 Total Reports: {stats.moderation.totalReports}</span>
          <span>🚫 Total Blocks: {stats.moderation.totalBlocks}</span>
        </div>
      </div>
    </div>
  );
}

// Reports Tab Component
function ReportsTab({ reports, onResolve }) {
  return (
    <div className="reports-list">
      <h2>Pending Reports</h2>
      {reports.length === 0 ? (
        <p className="empty-state">No pending reports</p>
      ) : (
        reports.map(report => (
          <div key={report._id} className="report-card">
            <div className="report-header">
              <span className="report-type">{report.reportType}</span>
              <span className="report-reason">{report.reason}</span>
              <span className="report-date">{new Date(report.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="report-body">
              <p><strong>Reporter:</strong> {report.reporter?.username || 'Unknown'} ({report.reporter?.email})</p>
              <p><strong>Reported User:</strong> {report.reportedUser?.username || 'N/A'} ({report.reportedUser?.email || 'N/A'})</p>
              {report.description && <p><strong>Description:</strong> {report.description}</p>}
            </div>
            <div className="report-actions">
              <button
                className="btn-resolve"
                onClick={() => onResolve(report._id, 'resolved', 'warning')}
              >
                ⚠️ Warning
              </button>
              <button
                className="btn-resolve"
                onClick={() => onResolve(report._id, 'resolved', 'content_removed')}
              >
                🗑️ Remove Content
              </button>
              <button
                className="btn-resolve"
                onClick={() => onResolve(report._id, 'dismissed', 'none')}
              >
                ❌ Dismiss
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// Users Tab Component
function UsersTab({ users, onSuspend, onBan, onUnsuspend, onUnban }) {
  return (
    <div className="users-list">
      <h2>User Management</h2>
      {users.length === 0 ? (
        <p className="empty-state">No users found</p>
      ) : (
        <table className="users-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user._id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`role-badge role-${user.role}`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  {user.isBanned && <span className="status-badge banned">Banned</span>}
                  {user.isSuspended && <span className="status-badge suspended">Suspended</span>}
                  {!user.isBanned && !user.isSuspended && user.isActive && <span className="status-badge active">Active</span>}
                  {!user.isActive && !user.isBanned && <span className="status-badge inactive">Inactive</span>}
                </td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="user-actions">
                  {(() => {
                    console.log(`User ${user.username}: role="${user.role}", checking super_admin...`);
                    const isSuperAdmin = user.role?.toLowerCase() === 'super_admin';
                    console.log(`Is super admin: ${isSuperAdmin}`);
                    return isSuperAdmin;
                  })() ? (
                    <span style={{ color: '#6C5CE7', fontWeight: 'bold' }}>
                      🛡️ Platform Owner (Protected)
                    </span>
                  ) : (
                    <>
                      {user.isSuspended ? (
                        <button className="btn-action" onClick={() => onUnsuspend(user._id)}>
                          🔓 Unsuspend
                        </button>
                      ) : (
                        <button className="btn-action" onClick={() => onSuspend(user._id)}>
                          ⏸️ Suspend
                        </button>
                      )}
                      {user.isBanned ? (
                        <button className="btn-action" onClick={() => onUnban(user._id)}>
                          ✅ Unban
                        </button>
                      ) : (
                        <button className="btn-action btn-danger" onClick={() => onBan(user._id)}>
                          🚫 Ban
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Blocks Tab Component
function BlocksTab({ blocks }) {
  return (
    <div className="blocks-list">
      <h2>User Blocks</h2>
      {blocks.length === 0 ? (
        <p className="empty-state">No blocks found</p>
      ) : (
        <table className="blocks-table">
          <thead>
            <tr>
              <th>Blocker</th>
              <th>Blocked User</th>
              <th>Date</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map(block => (
              <tr key={block._id}>
                <td>{block.blocker?.username} ({block.blocker?.email})</td>
                <td>{block.blocked?.username} ({block.blocked?.email})</td>
                <td>{new Date(block.createdAt).toLocaleDateString()}</td>
                <td>{block.reason || 'No reason provided'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Activity Tab Component
function ActivityTab({ activity }) {
  return (
    <div className="activity-container">
      <h2>Recent Activity ({activity.period})</h2>

      <div className="activity-section">
        <h3>📝 Recent Posts ({activity.recentPosts.length})</h3>
        <div className="activity-list">
          {activity.recentPosts.slice(0, 10).map(post => (
            <div key={post._id} className="activity-item">
              <span className="activity-user">{post.author?.username}</span>
              <span className="activity-content">{post.content?.substring(0, 100)}...</span>
              <span className="activity-date">{new Date(post.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="activity-section">
        <h3>👥 New Users ({activity.recentUsers.length})</h3>
        <div className="activity-list">
          {activity.recentUsers.slice(0, 10).map(user => (
            <div key={user._id} className="activity-item">
              <span className="activity-user">{user.username}</span>
              <span className="activity-content">{user.email}</span>
              <span className="activity-date">{new Date(user.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="activity-section">
        <h3>🚩 Recent Reports ({activity.recentReports.length})</h3>
        <div className="activity-list">
          {activity.recentReports.slice(0, 10).map(report => (
            <div key={report._id} className="activity-item">
              <span className="activity-user">{report.reporter?.username}</span>
              <span className="activity-content">
                Reported {report.reportType}: {report.reason}
              </span>
              <span className="activity-date">{new Date(report.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Admin;

// Add return statement to main component
// Find the return statement and add loading/error states

