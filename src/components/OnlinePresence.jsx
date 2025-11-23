import { useState, useEffect } from 'react';
import { onUserOnline, onUserOffline, onOnlineUsers } from '../utils/socket';
import './OnlinePresence.css';

function OnlinePresence() {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    // Get initial online users list
    onOnlineUsers((users) => {
      setOnlineUsers(users);
    });

    // Listen for users coming online
    onUserOnline((data) => {
      setOnlineUsers((prev) => {
        if (!prev.includes(data.userId)) {
          return [...prev, data.userId];
        }
        return prev;
      });
    });

    // Listen for users going offline
    onUserOffline((data) => {
      setOnlineUsers((prev) => prev.filter(id => id !== data.userId));
    });
  }, []);

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
            <h4>Online Now</h4>
            <button 
              className="btn-close"
              onClick={() => setShowDropdown(false)}
            >
              ×
            </button>
          </div>
          <div className="online-list">
            {onlineUsers.length > 0 ? (
              <p>{onlineUsers.length} user{onlineUsers.length !== 1 ? 's' : ''} online</p>
            ) : (
              <p>No other users online</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default OnlinePresence;
