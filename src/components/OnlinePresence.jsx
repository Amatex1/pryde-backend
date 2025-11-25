import { useState, useEffect } from 'react';
import { onUserOnline, onUserOffline, onOnlineUsers } from '../utils/socket';
import api from '../utils/api';
import './OnlinePresence.css';

function OnlinePresence({ onOpenMiniChat }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [onlineFriends, setOnlineFriends] = useState([]);
  const [offlineFriends, setOfflineFriends] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('online'); // 'online' or 'offline'

  // Helper function to get image URL
  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${import.meta.env.VITE_API_URL || 'https://pryde-social.onrender.com'}${path}`;
  };

  // Helper function to format time since last seen
  const getTimeSince = (date) => {
    if (!date) return 'Unknown';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Fetch online and offline friends
  const fetchFriends = async () => {
    try {
      const [onlineRes, offlineRes] = await Promise.all([
        api.get('/friends/online'),
        api.get('/friends/offline')
      ]);
      setOnlineFriends(onlineRes.data);
      setOfflineFriends(offlineRes.data);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  useEffect(() => {
    // Get initial online users list
    onOnlineUsers((users) => {
      setOnlineUsers(users);
    });

    // Fetch friends when dropdown opens
    if (showDropdown) {
      fetchFriends();
    }

    // Listen for users coming online
    onUserOnline((data) => {
      setOnlineUsers((prev) => {
        if (!prev.includes(data.userId)) {
          return [...prev, data.userId];
        }
        return prev;
      });
      // Refresh friends list
      if (showDropdown) {
        fetchFriends();
      }
    });

    // Listen for users going offline
    onUserOffline((data) => {
      setOnlineUsers((prev) => prev.filter(id => id !== data.userId));
      // Refresh friends list
      if (showDropdown) {
        fetchFriends();
      }
    });

    // Refresh friends list every 30 seconds when dropdown is open
    let interval;
    if (showDropdown) {
      interval = setInterval(fetchFriends, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showDropdown]);

  return (
    <div className="online-presence">
      <button
        className="online-indicator glossy"
        onClick={() => setShowDropdown(!showDropdown)}
        title={`${onlineUsers.length} users online`}
      >
        <span className="online-dot"></span>
        <span className="online-count">{onlineUsers.length}</span>
      </button>

      {showDropdown && (
        <div className="online-dropdown glossy">
          <div className="dropdown-header">
            <h4>Friends</h4>
            <button
              className="btn-close"
              onClick={() => setShowDropdown(false)}
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="friends-tabs">
            <button
              className={`tab ${activeTab === 'online' ? 'active' : ''}`}
              onClick={() => setActiveTab('online')}
            >
              Online ({onlineFriends.length})
            </button>
            <button
              className={`tab ${activeTab === 'offline' ? 'active' : ''}`}
              onClick={() => setActiveTab('offline')}
            >
              Offline ({offlineFriends.length})
            </button>
          </div>

          {/* Online Friends */}
          {activeTab === 'online' && (
            <div className="friends-list">
              {onlineFriends.length > 0 ? (
                onlineFriends.map(friend => (
                  <div
                    key={friend._id}
                    className="friend-item"
                    onClick={() => {
                      if (onOpenMiniChat) {
                        onOpenMiniChat(friend._id, friend.displayName || friend.username, friend.profilePhoto);
                      }
                    }}
                  >
                    <div className="friend-avatar">
                      {friend.profilePhoto ? (
                        <img src={getImageUrl(friend.profilePhoto)} alt={friend.username} />
                      ) : (
                        <div className="avatar-placeholder">
                          {(friend.displayName || friend.username).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="status-dot online"></span>
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">{friend.displayName || friend.username}</span>
                      <span className="friend-status">Online</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-friends">No friends online</p>
              )}
            </div>
          )}

          {/* Offline Friends */}
          {activeTab === 'offline' && (
            <div className="friends-list">
              {offlineFriends.length > 0 ? (
                offlineFriends.map(friend => (
                  <div
                    key={friend._id}
                    className="friend-item"
                    onClick={() => {
                      if (onOpenMiniChat) {
                        onOpenMiniChat(friend._id, friend.displayName || friend.username, friend.profilePhoto);
                      }
                    }}
                  >
                    <div className="friend-avatar">
                      {friend.profilePhoto ? (
                        <img src={getImageUrl(friend.profilePhoto)} alt={friend.username} />
                      ) : (
                        <div className="avatar-placeholder">
                          {(friend.displayName || friend.username).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="status-dot offline"></span>
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">{friend.displayName || friend.username}</span>
                      <span className="friend-status">{getTimeSince(friend.lastSeen)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-friends">No offline friends</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OnlinePresence;
