import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { onUserOnline, onUserOffline, onOnlineUsers } from '../utils/socket';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUtils';
import './OnlinePresence.css';

function OnlinePresence({ onOpenMiniChat }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allFriends, setAllFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Fetch all friends
  const fetchFriends = async () => {
    try {
      const response = await api.get('/friends');
      setAllFriends(response.data);
      setFilteredFriends(response.data);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  // Filter friends based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredFriends(allFriends);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = allFriends.filter(friend =>
        (friend.displayName?.toLowerCase().includes(query)) ||
        (friend.username?.toLowerCase().includes(query))
      );
      setFilteredFriends(filtered);
    }
  }, [searchQuery, allFriends]);

  useEffect(() => {
    // Get initial online users list
    const cleanupOnlineUsers = onOnlineUsers((users) => {
      setOnlineUsers(users);
    });

    // Fetch friends when dropdown opens
    if (showDropdown) {
      fetchFriends();
    }

    // Listen for users coming online
    const cleanupUserOnline = onUserOnline((data) => {
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
    const cleanupUserOffline = onUserOffline((data) => {
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
      cleanupOnlineUsers?.();
      cleanupUserOnline?.();
      cleanupUserOffline?.();
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
            <h4>Friends ({allFriends.length})</h4>
            <button
              className="btn-close"
              onClick={() => setShowDropdown(false)}
            >
              ×
            </button>
          </div>

          {/* Search Bar */}
          <div className="friends-search">
            <input
              type="text"
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {/* All Friends List */}
          <div className="friends-list">
            {filteredFriends.length > 0 ? (
              filteredFriends.map(friend => {
                const isOnline = onlineUsers.includes(friend._id);

                return friend.isActive === false ? (
                  <div
                    key={friend._id}
                    className="friend-item deactivated-friend"
                    onClick={() => alert('This user has deactivated their account.')}
                    style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                  >
                    <div className="friend-avatar deactivated-avatar">
                      <div className="avatar-placeholder">?</div>
                    </div>
                    <div className="friend-info">
                      <span className="friend-name deactivated-text">{friend.displayName || friend.username}</span>
                      <span className="friend-status deactivated-text">Deactivated</span>
                    </div>
                  </div>
                ) : (
                  <Link
                    key={friend._id}
                    to={`/profile/${friend._id}`}
                    className="friend-item"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="friend-avatar">
                      {friend.profilePhoto ? (
                        <img src={getImageUrl(friend.profilePhoto)} alt={friend.username} />
                      ) : (
                        <div className="avatar-placeholder">
                          {(friend.displayName || friend.username).charAt(0).toUpperCase()}
                        </div>
                      )}
                      {isOnline && <span className="status-dot online"></span>}
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">{friend.displayName || friend.username}</span>
                      <span className="friend-status">
                        {isOnline ? 'Online' : getTimeSince(friend.lastSeen)}
                      </span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <p className="no-friends">
                {searchQuery ? 'No friends found' : 'No friends yet'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default OnlinePresence;
