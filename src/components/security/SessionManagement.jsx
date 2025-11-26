import { useState, useEffect } from 'react';
import api from '../../utils/api';
import './SessionManagement.css';

function SessionManagement() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/sessions');
      setSessions(response.data.sessions);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setMessage('Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to logout this session?')) {
      return;
    }

    try {
      await api.delete(`/sessions/${sessionId}`);
      setMessage('Session logged out successfully');
      fetchSessions();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to logout session:', error);
      setMessage('Failed to logout session');
    }
  };

  const handleLogoutOthers = async () => {
    if (!window.confirm('Are you sure you want to logout all other sessions? You will remain logged in on this device.')) {
      return;
    }

    try {
      await api.post('/sessions/logout-others');
      setMessage('All other sessions logged out successfully');
      fetchSessions();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to logout other sessions:', error);
      setMessage('Failed to logout other sessions');
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('⚠️ WARNING: This will log you out from ALL devices, including this one. You will need to log in again. Continue?')) {
      return;
    }

    try {
      await api.post('/sessions/logout-all');
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to logout all sessions:', error);
      setMessage('Failed to logout all sessions');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };

  const getDeviceIcon = (browser, os) => {
    // OS icons
    if (os.includes('Windows')) return '🖥️';
    if (os.includes('Mac')) return '💻';
    if (os.includes('Linux')) return '🐧';
    if (os.includes('Android')) return '📱';
    if (os.includes('iOS')) return '📱';
    
    // Browser icons as fallback
    if (browser.includes('Chrome')) return '🌐';
    if (browser.includes('Firefox')) return '🦊';
    if (browser.includes('Safari')) return '🧭';
    if (browser.includes('Edge')) return '🌊';
    
    return '💻';
  };

  if (loading) {
    return <div className="sessions-loading">Loading active sessions...</div>;
  }

  return (
    <div className="session-management">
      {message && (
        <div className={`session-message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {sessions.length > 1 && (
        <div className="session-actions" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <button onClick={handleLogoutOthers} className="btn-secondary">
            🚪 Logout Other Sessions
          </button>
          <button onClick={handleLogoutAll} className="btn-danger">
            ⚠️ Logout All Sessions
          </button>
        </div>
      )}

      <div className="sessions-list">
        {sessions.map((session) => (
          <div 
            key={session.sessionId} 
            className={`session-card ${session.isCurrent ? 'current-session' : ''}`}
          >
            <div className="session-header">
              <div className="session-icon">
                {getDeviceIcon(session.browser, session.os)}
              </div>
              <div className="session-info">
                <div className="session-device">
                  <strong>{session.browser}</strong> on {session.os}
                  {session.isCurrent && (
                    <span className="current-badge">Current Session</span>
                  )}
                </div>
                <div className="session-details">
                  <span className="session-ip">📍 {session.ipAddress}</span>
                  {session.location?.city && (
                    <span className="session-location">
                      {session.location.city}, {session.location.country}
                    </span>
                  )}
                </div>
                <div className="session-time">
                  <span>Last active: {formatDate(session.lastActive)}</span>
                  <span style={{ color: '#999', fontSize: '13px' }}>
                    • Created: {formatDate(session.createdAt)}
                  </span>
                </div>
              </div>
              {!session.isCurrent && (
                <button
                  onClick={() => handleLogoutSession(session.sessionId)}
                  className="btn-logout-session"
                  title="Logout this session"
                >
                  🚪 Logout
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {sessions.length === 0 && (
        <div className="no-sessions">
          <p>No active sessions found.</p>
        </div>
      )}
    </div>
  );
}

export default SessionManagement;

