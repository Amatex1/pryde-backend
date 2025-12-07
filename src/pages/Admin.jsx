import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CustomModal from '../components/CustomModal';
import OptimizedImage from '../components/OptimizedImage';
import { useModal } from '../hooks/useModal';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import { getSocket } from '../utils/socket';
import './Admin.css';

function Admin() {
  const { modalState, closeModal, showAlert, showConfirm, showPrompt } = useModal();
  const location = useLocation();
  const navigate = useNavigate();

  // Get tab from URL or default to dashboard
  const getTabFromUrl = () => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') || 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl());
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [activity, setActivity] = useState(null);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [securityStats, setSecurityStats] = useState(null);
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const listenersSetUpRef = useRef(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadTabData();
    }
  }, [activeTab, currentUser]);

  // Sync tab with URL
  useEffect(() => {
    const tab = getTabFromUrl();
    if (tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location.search]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`/admin?tab=${tab}`);
  };

  const handleViewPost = async (postId) => {
    try {
      const response = await api.get(`/admin/posts?postId=${postId}`);
      setSelectedPost(response.data);
      setShowPostModal(true);
    } catch (error) {
      console.error('Error fetching post:', error);
      showAlert('Error', 'Failed to load post details');
    }
  };

  const handleClosePostModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
  };

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
      } else if (activeTab === 'security') {
        const response = await api.get('/admin/security-logs?limit=100');
        setSecurityLogs(response.data.logs);
        setSecurityStats(response.data.stats);
      } else if (activeTab === 'verification') {
        const response = await api.get('/admin/verification-requests?status=pending');
        setVerificationRequests(response.data.requests);
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
      showAlert('Report updated successfully', 'Success');
      loadTabData();
    } catch (error) {
      console.error('Resolve report error:', error);
      showAlert('Failed to update report', 'Error');
    }
  };

  const handleSuspendUser = async (userId) => {
    const days = await showPrompt('Suspend for how many days?', 'Suspend User', 'Number of days', '7', 'number');
    if (!days) return;

    const reason = await showPrompt('Reason for suspension:', 'Suspension Reason', 'Enter reason', 'Violation of Terms of Service');
    if (!reason) return;

    try {
      await api.put(`/admin/users/${userId}/suspend`, { days: parseInt(days), reason });
      showAlert('User suspended successfully', 'Success');
      loadTabData();
    } catch (error) {
      console.error('Suspend user error:', error);
      showAlert(error.response?.data?.message || 'Failed to suspend user', 'Error');
    }
  };

  const handleBanUser = async (userId) => {
    const confirmed = await showConfirm('Are you sure you want to permanently ban this user?', 'Ban User', 'Ban', 'Cancel');
    if (!confirmed) return;

    const reason = await showPrompt('Reason for ban:', 'Ban Reason', 'Enter reason', 'Severe violation of Terms of Service');
    if (!reason) return;

    try {
      await api.put(`/admin/users/${userId}/ban`, { reason });
      showAlert('User banned successfully', 'Success');
      loadTabData();
    } catch (error) {
      console.error('Ban user error:', error);
      showAlert(error.response?.data?.message || 'Failed to ban user', 'Error');
    }
  };

  const handleUnsuspendUser = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/unsuspend`);
      showAlert('User unsuspended successfully', 'Success');
      loadTabData();
    } catch (error) {
      console.error('Unsuspend user error:', error);
      showAlert('Failed to unsuspend user', 'Error');
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/unban`);
      showAlert('User unbanned successfully', 'Success');
      loadTabData();
    } catch (error) {
      console.error('Unban user error:', error);
      showAlert('Failed to unban user', 'Error');
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    const confirmed = await showConfirm(
      `Are you sure you want to change this user's role to ${newRole}?`,
      'Change User Role',
      'Change Role',
      'Cancel'
    );
    if (!confirmed) return;

    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      showAlert(`User role changed to ${newRole} successfully`, 'Success');
      loadTabData();
    } catch (error) {
      console.error('Change role error:', error);
      showAlert(error.response?.data?.message || 'Failed to change user role', 'Error');
    }
  };

  const handleResolveSecurityLog = async (logId) => {
    const notes = await showPrompt('Add notes (optional):', 'Resolve Security Log', 'Notes', '');

    try {
      await api.put(`/admin/security-logs/${logId}/resolve`, { notes });
      showAlert('Security log marked as resolved', 'Success');
      loadTabData();
    } catch (error) {
      console.error('Resolve security log error:', error);
      showAlert('Failed to resolve security log', 'Error');
    }
  };

  const handleVerificationAction = async (userId, action) => {
    try {
      const actionText = action === 'approve' ? 'approve' : 'deny';
      const confirmed = await showConfirm(
        `Are you sure you want to ${actionText} this verification request?`,
        `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Verification`
      );

      if (!confirmed) return;

      await api.put(`/admin/verification-requests/${userId}`, { action });
      showAlert(`Verification ${action === 'approve' ? 'approved' : 'denied'} successfully`, 'Success');
      loadTabData();
    } catch (error) {
      console.error('Verification action error:', error);
      showAlert('Failed to process verification request', 'Error');
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
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading admin panel...</p>
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
            background: 'var(--warning)',
            borderRadius: '12px',
            margin: '2rem 0',
            border: '2px solid var(--warning)'
          }}>
            <h2 style={{ color: 'white', marginBottom: '1rem' }}>⚠️ {error}</h2>
            <p style={{ color: 'white', marginBottom: '1rem' }}>
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
            onClick={() => handleTabChange('dashboard')}
          >
            📊 Dashboard
          </button>
          <button
            className={`admin-tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => handleTabChange('reports')}
          >
            🚩 Reports
          </button>
          <button
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => handleTabChange('users')}
          >
            👥 Users
          </button>
          <button
            className={`admin-tab ${activeTab === 'blocks' ? 'active' : ''}`}
            onClick={() => handleTabChange('blocks')}
          >
            🚫 Blocks
          </button>
          <button
            className={`admin-tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => handleTabChange('activity')}
          >
            📈 Activity
          </button>
          <button
            className={`admin-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => handleTabChange('security')}
          >
            🔒 Security
          </button>
          <button
            className={`admin-tab ${activeTab === 'verification' ? 'active' : ''}`}
            onClick={() => handleTabChange('verification')}
          >
            ✓ Verification
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
              onChangeRole={handleChangeRole}
            />
          )}
          {activeTab === 'blocks' && (
            <BlocksTab blocks={blocks} />
          )}
          {activeTab === 'activity' && activity && (
            <ActivityTab activity={activity} onViewPost={handleViewPost} />
          )}
          {activeTab === 'security' && (
            <SecurityTab
              logs={securityLogs}
              stats={securityStats}
              onResolve={handleResolveSecurityLog}
            />
          )}
          {activeTab === 'verification' && (
            <VerificationTab
              requests={verificationRequests}
              onAction={handleVerificationAction}
            />
          )}
        </div>
      </div>

      <CustomModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        placeholder={modalState.placeholder}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={modalState.onConfirm}
        inputType={modalState.inputType}
        defaultValue={modalState.defaultValue}
      />

      {/* Post Modal for Admin Content Viewing */}
      {showPostModal && selectedPost && (
        <PostModal post={selectedPost} onClose={handleClosePostModal} />
      )}
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
  const [expandedReport, setExpandedReport] = useState(null);

  const renderContentPreview = (report) => {
    if (report.reportType === 'post' && report.reportedPost) {
      const post = report.reportedPost;
      return (
        <div className="content-preview">
          <h4>📝 Reported Post Preview:</h4>
          <div className="preview-card">
            <div className="preview-author">
              {post.author?.profilePhoto && (
                <img src={getImageUrl(post.author.profilePhoto)} alt={post.author.username} className="preview-avatar" />
              )}
              <span>{post.author?.displayName || post.author?.username || 'Unknown'}</span>
            </div>
            <p className="preview-content">{post.content}</p>
            {post.media && post.media.length > 0 && (
              <div className="preview-media">
                {post.media.slice(0, 3).map((media, idx) => (
                  <div key={idx} className="preview-media-item">
                    {media.type === 'image' ? (
                      <img src={getImageUrl(media.url)} alt="Post media" />
                    ) : (
                      <video src={getImageUrl(media.url)} />
                    )}
                  </div>
                ))}
                {post.media.length > 3 && <span>+{post.media.length - 3} more</span>}
              </div>
            )}
            <div className="preview-stats">
              <span>❤️ {post.likes?.length || 0}</span>
              <span>💬 {post.comments?.length || 0}</span>
              <span>📅 {new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      );
    }

    if (report.reportType === 'comment' && report.reportedComment) {
      const comment = report.reportedComment;
      return (
        <div className="content-preview">
          <h4>💬 Reported Comment Preview:</h4>
          <div className="preview-card">
            <div className="preview-author">
              {comment.user?.profilePhoto && (
                <img src={getImageUrl(comment.user.profilePhoto)} alt={comment.user.username} className="preview-avatar" />
              )}
              <span>{comment.user?.displayName || comment.user?.username || 'Unknown'}</span>
            </div>
            <p className="preview-content">{comment.content}</p>
            <div className="preview-stats">
              <span>📅 {new Date(comment.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      );
    }

    if (report.reportType === 'user' && report.reportedUser) {
      const user = report.reportedUser;
      return (
        <div className="content-preview">
          <h4>👤 Reported User Profile:</h4>
          <div className="preview-card">
            <div className="preview-author">
              {user.profilePhoto && (
                <img src={getImageUrl(user.profilePhoto)} alt={user.username} className="preview-avatar" />
              )}
              <div>
                <div><strong>{user.displayName || user.username}</strong></div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>@{user.username}</div>
                <div style={{ color: '#666', fontSize: '0.9em' }}>{user.email}</div>
              </div>
            </div>
            {user.bio && <p className="preview-content">{user.bio}</p>}
          </div>
        </div>
      );
    }

    return null;
  };

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

              <button
                className="btn-preview"
                onClick={() => setExpandedReport(expandedReport === report._id ? null : report._id)}
                style={{
                  marginTop: '10px',
                  padding: '8px 16px',
                  background: 'var(--pryde-purple)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                {expandedReport === report._id ? '🔼 Hide Preview' : '🔽 Show Content Preview'}
              </button>

              {expandedReport === report._id && renderContentPreview(report)}
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
function UsersTab({ users, onSuspend, onBan, onUnsuspend, onUnban, onChangeRole }) {
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
                <td data-label="Username">{user.username}</td>
                <td data-label="Email">{user.email}</td>
                <td data-label="Role">
                  {user.role?.toLowerCase() === 'super_admin' ? (
                    <span className={`role-badge role-${user.role}`}>
                      {user.role}
                    </span>
                  ) : (
                    <select
                      className={`role-select role-${user.role}`}
                      value={user.role}
                      onChange={(e) => onChangeRole(user._id, e.target.value)}
                    >
                      <option value="user">user</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  )}
                </td>
                <td data-label="Status">
                  {user.isBanned && <span className="status-badge banned">Banned</span>}
                  {user.isSuspended && <span className="status-badge suspended">Suspended</span>}
                  {!user.isBanned && !user.isSuspended && user.isActive && <span className="status-badge active">Active</span>}
                  {!user.isActive && !user.isBanned && <span className="status-badge inactive">Inactive</span>}
                </td>
                <td data-label="Joined">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td data-label="Actions" className="user-actions">
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
                <td data-label="Blocker">{block.blocker?.username} ({block.blocker?.email})</td>
                <td data-label="Blocked User">{block.blocked?.username} ({block.blocked?.email})</td>
                <td data-label="Date">{new Date(block.createdAt).toLocaleDateString()}</td>
                <td data-label="Reason">{block.reason || 'No reason provided'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Activity Tab Component
function ActivityTab({ activity, onViewPost }) {
  const navigate = useNavigate();

  return (
    <div className="activity-container">
      <h2>Recent Activity ({activity.period})</h2>

      <div className="activity-section">
        <h3>📝 Recent Posts ({activity.recentPosts.length})</h3>
        <div className="activity-table">
          <div className="activity-table-header">
            <span className="activity-header-author">Author</span>
            <span className="activity-header-post">Post</span>
            <span className="activity-header-date">Date Posted</span>
          </div>
          <div className="activity-list">
            {activity.recentPosts.slice(0, 10).map(post => (
              <div key={post._id} className="activity-item">
                <span
                  className="activity-user-link"
                  onClick={() => navigate(`/profile/${post.author?._id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  {post.author?.displayName || post.author?.username}
                </span>
                <span
                  className="activity-post-link"
                  onClick={() => onViewPost(post._id)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view full post in modal"
                >
                  {post.content?.substring(0, 100)}{post.content?.length > 100 ? '...' : ''}
                </span>
                <span className="activity-date">{new Date(post.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="activity-section">
        <h3>👥 New Users ({activity.recentUsers.length})</h3>
        <div className="activity-table">
          <div className="activity-table-header">
            <span className="activity-header-realname">Display Name</span>
            <span className="activity-header-username">Username</span>
            <span className="activity-header-email">Email</span>
            <span className="activity-header-date">Date Joined</span>
          </div>
          <div className="activity-list">
            {activity.recentUsers.slice(0, 10).map(user => (
              <div key={user._id} className="activity-item">
                <span className="activity-realname">{user.displayName || user.username}</span>
                <span
                  className="activity-user-link"
                  onClick={() => navigate(`/profile/${user._id}`)}
                  style={{ cursor: 'pointer' }}
                  title="View profile"
                >
                  {user.username}
                </span>
                <span className="activity-email">{user.email}</span>
                <span className="activity-date">{new Date(user.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="activity-section">
        <h3>🚩 Recent Reports ({activity.recentReports.length})</h3>
        <div className="activity-table">
          <div className="activity-table-header">
            <span className="activity-header-reporter">Reporter</span>
            <span className="activity-header-report">Report Details</span>
            <span className="activity-header-date">Date Reported</span>
          </div>
          <div className="activity-list">
            {activity.recentReports.slice(0, 10).map(report => (
              <div key={report._id} className="activity-item">
                <span
                  className="activity-user-link"
                  onClick={() => navigate(`/profile/${report.reporter?._id}`)}
                  style={{ cursor: 'pointer' }}
                  title="View reporter profile"
                >
                  {report.reporter?.displayName || report.reporter?.username}
                </span>
                <span className="activity-content">
                  Reported {report.reportType}: {report.reason}
                </span>
                <span className="activity-date">{new Date(report.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Security Tab Component
function SecurityTab({ logs, stats, onResolve }) {
  const [filter, setFilter] = useState('all');

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'unresolved') return !log.resolved;
    if (filter === 'underage') return log.type.includes('underage');
    return log.type === filter;
  });

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#ff8c00';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'underage_registration': return '🚫 Underage Registration';
      case 'underage_login': return '🔒 Underage Login';
      case 'underage_access': return '⚠️ Underage Access';
      case 'failed_login': return '❌ Failed Login';
      case 'suspicious_activity': return '🔍 Suspicious Activity';
      default: return type;
    }
  };

  return (
    <div className="security-container">
      <h2>🔒 Security Logs</h2>

      {stats && (
        <div className="security-stats">
          <div className="stat-card">
            <h3>Total Logs</h3>
            <p className="stat-number">{stats.total}</p>
          </div>
          <div className="stat-card">
            <h3>Unresolved</h3>
            <p className="stat-number" style={{ color: '#ff8c00' }}>{stats.unresolved}</p>
          </div>
          <div className="stat-card">
            <h3>Underage Attempts</h3>
            <p className="stat-number" style={{ color: '#dc3545' }}>
              {stats.byType.underage_registration + stats.byType.underage_login + stats.byType.underage_access}
            </p>
          </div>
          <div className="stat-card">
            <h3>Critical</h3>
            <p className="stat-number" style={{ color: '#dc3545' }}>{stats.bySeverity.critical}</p>
          </div>
        </div>
      )}

      <div className="security-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({logs.length})
        </button>
        <button
          className={`filter-btn ${filter === 'unresolved' ? 'active' : ''}`}
          onClick={() => setFilter('unresolved')}
        >
          Unresolved ({logs.filter(l => !l.resolved).length})
        </button>
        <button
          className={`filter-btn ${filter === 'underage' ? 'active' : ''}`}
          onClick={() => setFilter('underage')}
        >
          Underage ({logs.filter(l => l.type.includes('underage')).length})
        </button>
      </div>

      <div className="security-logs-list">
        {filteredLogs.length === 0 ? (
          <div className="empty-state">No security logs found</div>
        ) : (
          filteredLogs.map(log => (
            <div key={log._id} className={`security-log-item ${log.resolved ? 'resolved' : 'unresolved'}`}>
              <div className="log-header">
                <span className="log-type">{getTypeLabel(log.type)}</span>
                <span
                  className="log-severity"
                  style={{
                    background: getSeverityColor(log.severity),
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}
                >
                  {log.severity.toUpperCase()}
                </span>
                <span className="log-date">{new Date(log.createdAt).toLocaleString()}</span>
              </div>

              <div className="log-details">
                {log.username && <p><strong>Username:</strong> {log.username}</p>}
                {log.email && <p><strong>Email:</strong> {log.email}</p>}
                {log.calculatedAge !== null && <p><strong>Age:</strong> {log.calculatedAge} years old</p>}
                {log.birthday && <p><strong>Birthday:</strong> {new Date(log.birthday).toLocaleDateString()}</p>}
                {log.ipAddress && <p><strong>IP:</strong> {log.ipAddress}</p>}
                {log.details && <p><strong>Details:</strong> {log.details}</p>}
                {log.action && (
                  <p>
                    <strong>Action:</strong>
                    <span style={{
                      marginLeft: '0.5rem',
                      padding: '0.25rem 0.5rem',
                      background: log.action === 'banned' ? '#dc3545' : log.action === 'blocked' ? '#ff8c00' : '#6c757d',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '0.875rem'
                    }}>
                      {log.action.toUpperCase()}
                    </span>
                  </p>
                )}
              </div>

              {log.resolved ? (
                <div className="log-resolved">
                  ✅ Resolved by {log.resolvedBy?.username || 'Admin'} on {new Date(log.resolvedAt).toLocaleString()}
                  {log.notes && <p className="log-notes"><strong>Notes:</strong> {log.notes}</p>}
                </div>
              ) : (
                <button
                  className="btn-resolve-log"
                  onClick={() => onResolve(log._id)}
                >
                  Mark as Resolved
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function VerificationTab({ requests, onAction }) {
  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2>✓ Verification Requests</h2>
        <p className="tab-subtitle">Review and approve user verification requests</p>
      </div>

      <div className="verification-requests">
        {requests.length === 0 ? (
          <div className="no-data">
            <p>No pending verification requests</p>
          </div>
        ) : (
          requests.map(request => (
            <div key={request._id} className="verification-card">
              <div className="verification-user">
                <Link to={`/profile/${request.username}`} className="user-link">
                  {request.profilePhoto ? (
                    <img src={getImageUrl(request.profilePhoto)} alt={request.username} />
                  ) : (
                    <div className="user-avatar">{request.displayName?.charAt(0) || 'U'}</div>
                  )}
                  <div className="user-info">
                    <div className="user-name">
                      {request.displayName || request.username}
                      {request.isVerified && <span className="verified-badge">✓</span>}
                    </div>
                    <div className="user-username">@{request.username}</div>
                    <div className="user-email">{request.email}</div>
                  </div>
                </Link>
              </div>

              <div className="verification-details">
                <div className="detail-row">
                  <span className="detail-label">Requested:</span>
                  <span className="detail-value">
                    {new Date(request.verificationRequestDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Member Since:</span>
                  <span className="detail-value">
                    {new Date(request.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                {request.verificationRequestReason && (
                  <div className="detail-row reason">
                    <span className="detail-label">Reason:</span>
                    <p className="detail-value">{request.verificationRequestReason}</p>
                  </div>
                )}
              </div>

              {!request.isVerified && (
                <div className="verification-actions">
                  <button
                    className="btn-approve"
                    onClick={() => onAction(request._id, 'approve')}
                  >
                    ✓ Approve
                  </button>
                  <button
                    className="btn-deny"
                    onClick={() => onAction(request._id, 'deny')}
                  >
                    ✗ Deny
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Post Modal Component for Admin Content Viewing
function PostModal({ post, onClose }) {
  if (!post) return null;

  return (
    <div className="admin-post-modal-overlay" onClick={onClose}>
      <div className="admin-post-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-post-modal-header">
          <h2>Post Details</h2>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="admin-post-modal-content">
          {/* Author Info */}
          <div className="admin-post-author">
            {post.author?.profilePhoto && (
              <img
                src={getImageUrl(post.author.profilePhoto)}
                alt={post.author.displayName || post.author.username}
                className="admin-post-author-avatar"
              />
            )}
            <div className="admin-post-author-info">
              <div className="admin-post-author-name">
                {post.author?.displayName || post.author?.username}
                {post.author?.isVerified && <span className="verified-badge">✓</span>}
              </div>
              <div className="admin-post-author-username">@{post.author?.username}</div>
              {post.author?.pronouns && (
                <div className="admin-post-author-pronouns">{post.author.pronouns}</div>
              )}
            </div>
          </div>

          {/* Post Content */}
          {post.content && (
            <div className="admin-post-content">
              <p>{post.content}</p>
            </div>
          )}

          {/* Content Warning */}
          {post.contentWarning && (
            <div className="admin-post-warning">
              <strong>⚠️ Content Warning:</strong> {post.contentWarning}
            </div>
          )}

          {/* Media */}
          {post.media && post.media.length > 0 && (
            <div className="admin-post-media">
              {post.media.map((item, index) => (
                <div key={index} className="admin-post-media-item">
                  {item.type === 'image' && (
                    <img src={getImageUrl(item.url)} alt={`Media ${index + 1}`} />
                  )}
                  {item.type === 'video' && (
                    <video src={getImageUrl(item.url)} controls />
                  )}
                  {item.type === 'gif' && (
                    <img src={getImageUrl(item.url)} alt={`GIF ${index + 1}`} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Legacy Images */}
          {post.images && post.images.length > 0 && (
            <div className="admin-post-media">
              {post.images.map((img, index) => (
                <OptimizedImage
                  key={index}
                  src={getImageUrl(img)}
                  alt={`Image ${index + 1}`}
                />
              ))}
            </div>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="admin-post-tags">
              <strong>Tags:</strong>
              {post.tags.map(tag => (
                <span key={tag._id} className="admin-post-tag">
                  {tag.icon} {tag.label}
                </span>
              ))}
            </div>
          )}

          {/* Post Metadata */}
          <div className="admin-post-metadata">
            <div className="admin-post-meta-item">
              <strong>Visibility:</strong> {post.visibility}
            </div>
            <div className="admin-post-meta-item">
              <strong>Created:</strong> {new Date(post.createdAt).toLocaleString()}
            </div>
            {post.updatedAt && post.updatedAt !== post.createdAt && (
              <div className="admin-post-meta-item">
                <strong>Updated:</strong> {new Date(post.updatedAt).toLocaleString()}
              </div>
            )}
            <div className="admin-post-meta-item">
              <strong>Reactions:</strong> {post.reactions?.length || 0}
            </div>
            <div className="admin-post-meta-item">
              <strong>Comments:</strong> {post.comments?.length || 0}
            </div>
          </div>

          {/* Reactions */}
          {post.reactions && post.reactions.length > 0 && (
            <div className="admin-post-reactions">
              <h3>Reactions ({post.reactions.length})</h3>
              <div className="admin-reactions-list">
                {post.reactions.map((reaction, index) => (
                  <div key={index} className="admin-reaction-item">
                    <span className="admin-reaction-emoji">{reaction.emoji}</span>
                    <span className="admin-reaction-user">
                      {reaction.user?.displayName || reaction.user?.username}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          {post.comments && post.comments.length > 0 && (
            <div className="admin-post-comments">
              <h3>Comments ({post.comments.length})</h3>
              <div className="admin-comments-list">
                {post.comments.map((comment) => (
                  <div key={comment._id} className="admin-comment-item">
                    <div className="admin-comment-header">
                      <strong>{comment.user?.displayName || comment.user?.username}</strong>
                      <span className="admin-comment-date">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="admin-comment-content">{comment.content}</div>
                    {comment.reactions && comment.reactions.length > 0 && (
                      <div className="admin-comment-reactions">
                        {comment.reactions.map((reaction, index) => (
                          <span key={index} className="admin-comment-reaction">
                            {reaction.emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Admin;

