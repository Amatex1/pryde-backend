import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { getCurrentUser, logout } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import OnlinePresence from './OnlinePresence';
import DarkModeToggle from './DarkModeToggle';
import GlobalSearch from './GlobalSearch';
import './Navbar.css';

function Navbar() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
    window.location.reload();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="navbar glossy">
      <div className="navbar-container">
        <Link to="/feed" className="navbar-brand">
          <span className="brand-icon">✨</span>
          <span className="brand-text">Pryde Social</span>
        </Link>

        <GlobalSearch />

        <div className="navbar-user" ref={dropdownRef}>
          <DarkModeToggle />
          <OnlinePresence />
          <div
            className="user-profile-trigger"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="user-avatar">
              {user?.profilePhoto ? (
                <img src={getImageUrl(user.profilePhoto)} alt={user.username} />
              ) : (
                <span>{user?.username?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <span className="user-name">{user?.displayName || user?.username}</span>
            <span className="dropdown-arrow">{showDropdown ? '▲' : '▼'}</span>
          </div>

          {showDropdown && (
            <div className="profile-dropdown">
              <Link to="/friends" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                <span className="dropdown-icon">👥</span>
                <span>Friends</span>
              </Link>
              <Link to="/messages" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                <span className="dropdown-icon">💬</span>
                <span>Messages</span>
              </Link>
              <Link to={`/profile/${user?.id}`} className="dropdown-item" onClick={() => setShowDropdown(false)}>
                <span className="dropdown-icon">👤</span>
                <span>Profile</span>
              </Link>
              <Link to="/settings" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                <span className="dropdown-icon">⚙️</span>
                <span>Settings</span>
              </Link>
              <div className="dropdown-divider"></div>
              <button onClick={handleLogout} className="dropdown-item logout-item">
                <span className="dropdown-icon">🚪</span>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
