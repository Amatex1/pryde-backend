import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import './PrivacySettings.css';

const PrivacySettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'public',
    isPrivateAccount: false,
    whoCanMessage: 'followers',
    showOnlineStatus: true,
    showLastSeen: true,
    whoCanSeeMyPosts: 'public',
    whoCanCommentOnMyPosts: 'everyone',
    whoCanSeeFollowersList: 'everyone',
    whoCanTagMe: 'followers',
    autoHideContentWarnings: false
  });
  const [blockedUsers, setBlockedUsers] = useState([]);

  useEffect(() => {
    fetchPrivacySettings();
    fetchBlockedUsers();
  }, []);

  const fetchPrivacySettings = async () => {
    try {
      const response = await api.get('/privacy');
      setPrivacySettings(response.data.privacySettings);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching privacy settings:', error);
      setMessage('Failed to load privacy settings');
      setLoading(false);
    }
  };

  const fetchBlockedUsers = async () => {
    try {
      const response = await api.get('/privacy/blocked');
      setBlockedUsers(response.data.blockedUsers);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    }
  };

  const handleSettingChange = (field, value) => {
    setPrivacySettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put('/privacy', { privacySettings });
      setMessage('Privacy settings updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      setMessage('Failed to update privacy settings');
    }
  };

  const handleUnblock = async (userId) => {
    try {
      await api.post(`/privacy/unblock/${userId}`);
      setBlockedUsers(prev => prev.filter(user => user._id !== userId));
      setMessage('User unblocked successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error unblocking user:', error);
      setMessage('Failed to unblock user');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="privacy-settings-container">
          <div className="loading">Loading privacy settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />
      
      <div className="privacy-settings-container">
        <div className="privacy-settings-card glossy fade-in">
          <div className="privacy-header">
            <button onClick={() => navigate('/settings')} className="back-button">
              ← Back to Settings
            </button>
            <h1 className="privacy-title text-shadow">🔒 Privacy Settings</h1>
          </div>

          {message && (
            <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave} className="privacy-form">
            {/* Profile Visibility */}
            <div className="privacy-section">
              <h2 className="section-title">👤 Profile Visibility</h2>
              
              <div className="setting-item">
                <label>Who Can See My Profile?</label>
                <select
                  value={privacySettings.profileVisibility}
                  onChange={(e) => handleSettingChange('profileVisibility', e.target.value)}
                >
                  <option value="public">Everyone</option>
                  <option value="followers">Followers Only</option>
                  <option value="private">Only Me</option>
                </select>
              </div>

              {/* PHASE 1 REFACTOR: Follower list visibility removed (follower counts hidden) */}
              {/* <div className="setting-item">
                <label>Who Can See My Followers/Following List?</label>
                <select
                  value={privacySettings.whoCanSeeFollowersList}
                  onChange={(e) => handleSettingChange('whoCanSeeFollowersList', e.target.value)}
                >
                  <option value="everyone">Everyone</option>
                  <option value="followers">Followers Only</option>
                  <option value="only-me">Only Me</option>
                </select>
              </div> */}

              <div className="setting-item checkbox-item">
                <label>
                  <input 
                    type="checkbox"
                    checked={privacySettings.showOnlineStatus}
                    onChange={(e) => handleSettingChange('showOnlineStatus', e.target.checked)}
                  />
                  Show my online status
                </label>
              </div>

              <div className="setting-item checkbox-item">
                <label>
                  <input
                    type="checkbox"
                    checked={privacySettings.showLastSeen}
                    onChange={(e) => handleSettingChange('showLastSeen', e.target.checked)}
                  />
                  Show when I was last seen
                </label>
              </div>
            </div>

            {/* Account Privacy */}
            <div className="privacy-section">
              <h2 className="section-title">🔐 Account Privacy</h2>

              <div className="setting-item checkbox-item">
                <label>
                  <input
                    type="checkbox"
                    checked={privacySettings.isPrivateAccount}
                    onChange={(e) => handleSettingChange('isPrivateAccount', e.target.checked)}
                  />
                  Private Account
                </label>
                <p className="setting-description">
                  {privacySettings.isPrivateAccount
                    ? "Your account is private. New followers need your approval."
                    : "Your account is public. Anyone can follow you instantly."}
                </p>
              </div>
            </div>

            {/* Messaging */}
            <div className="privacy-section">
              <h2 className="section-title">💬 Messaging</h2>

              <div className="setting-item">
                <label>Who Can Send Me Messages?</label>
                <select
                  value={privacySettings.whoCanMessage}
                  onChange={(e) => handleSettingChange('whoCanMessage', e.target.value)}
                >
                  <option value="everyone">Everyone</option>
                  <option value="followers">Followers Only</option>
                  <option value="no-one">No One</option>
                </select>
              </div>
            </div>

            {/* Posts & Content */}
            <div className="privacy-section">
              <h2 className="section-title">📝 Posts & Content</h2>

              <div className="setting-item">
                <label>Who Can See My Posts?</label>
                <select
                  value={privacySettings.whoCanSeeMyPosts}
                  onChange={(e) => handleSettingChange('whoCanSeeMyPosts', e.target.value)}
                >
                  <option value="public">Everyone</option>
                  <option value="followers">Followers Only</option>
                  <option value="only-me">Only Me</option>
                </select>
              </div>

              <div className="setting-item">
                <label>Who Can Comment on My Posts?</label>
                <select
                  value={privacySettings.whoCanCommentOnMyPosts}
                  onChange={(e) => handleSettingChange('whoCanCommentOnMyPosts', e.target.value)}
                >
                  <option value="everyone">Everyone</option>
                  <option value="followers">Followers Only</option>
                  <option value="no-one">No One</option>
                </select>
              </div>

              <div className="setting-item">
                <label>Who Can Tag Me in Posts?</label>
                <select
                  value={privacySettings.whoCanTagMe}
                  onChange={(e) => handleSettingChange('whoCanTagMe', e.target.value)}
                >
                  <option value="everyone">Everyone</option>
                  <option value="followers">Followers Only</option>
                  <option value="no-one">No One</option>
                </select>
              </div>

              <div className="setting-item toggle-item">
                <div className="toggle-info">
                  <label>Auto-Hide Content Warnings</label>
                  <p className="setting-description">
                    Automatically hide all posts with content warnings. You can still reveal them by clicking "Show Content".
                  </p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={privacySettings.autoHideContentWarnings}
                    onChange={(e) => handleSettingChange('autoHideContentWarnings', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {/* Blocked Users */}
            <div className="privacy-section">
              <h2 className="section-title">🚫 Blocked Users</h2>

              {blockedUsers.length === 0 ? (
                <p className="no-blocked-users">You haven't blocked anyone yet.</p>
              ) : (
                <div className="blocked-users-list">
                  {blockedUsers.map(user => (
                    <div key={user._id} className="blocked-user-item">
                      <div className="blocked-user-info">
                        <img
                          src={user.profilePhoto || '/default-avatar.png'}
                          alt={user.username}
                          className="blocked-user-avatar"
                        />
                        <div className="blocked-user-details">
                          <span className="blocked-user-name">{user.displayName || user.username}</span>
                          <span className="blocked-user-username">@{user.username}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnblock(user._id)}
                        className="unblock-button"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="privacy-actions">
              <button type="submit" className="btn-primary">
                💾 Save Privacy Settings
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PrivacySettings;

