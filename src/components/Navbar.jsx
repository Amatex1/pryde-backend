import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { getCurrentUser, logout } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import DarkModeToggle from './DarkModeToggle';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import api from '../utils/api';
import './Navbar.css';

// Hook to get dark mode state
function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  const toggleDarkMode = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    localStorage.setItem('darkMode', newValue);
    if (newValue) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  return [isDark, toggleDarkMode];
}

function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const [isDark, toggleDarkMode] = useDarkMode();
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  const handleLogout = () => {
    logout();
    // logout() now handles redirect internally with window.location.href
  };

  // Fetch current user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await api.get('/auth/me');
        setUser(response.data);
        // Update localStorage with fresh data
        localStorage.setItem('user', JSON.stringify(response.data));
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchUserData();
    // Poll every 60 seconds to keep profile updated
    const interval = setInterval(fetchUserData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch unread message counts
  useEffect(() => {
    const fetchUnreadCounts = async () => {
      try {
        const response = await api.get('/messages/unread/counts');
        setTotalUnreadMessages(response.data.totalUnread);
      } catch (error) {
        console.error('Failed to fetch unread message counts:', error);
      }
    };

    fetchUnreadCounts();
    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setShowMobileMenu(false);
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

        {/* Mobile Hamburger Menu */}
        <button
          className="mobile-hamburger-btn"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          aria-label="Toggle menu"
        >
          {showMobileMenu ? '✕' : '☰'}
        </button>

        {/* Mobile Menu Overlay */}
        {showMobileMenu && (
          <div
            className="mobile-menu-overlay"
            onClick={() => setShowMobileMenu(false)}
          />
        )}

        {/* Mobile Menu */}
        <div className={`mobile-menu ${showMobileMenu ? 'mobile-menu-visible' : ''}`} ref={mobileMenuRef}>
          <div className="mobile-menu-header">
            <div className="mobile-menu-user">
              <div className="mobile-menu-avatar">
                {user?.profilePhoto ? (
                  <img src={getImageUrl(user.profilePhoto)} alt={user.username} />
                ) : (
                  <span>{user?.username?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="mobile-menu-user-info">
                <div className="mobile-menu-username">{user?.displayName || user?.username}</div>
                <Link to={`/profile/${user?.username}`} className="mobile-menu-view-profile" onClick={() => setShowMobileMenu(false)}>
                  View Profile
                </Link>
              </div>
            </div>
          </div>

          <div className="mobile-menu-items">
            <Link to="/messages" className="mobile-menu-item" onClick={() => setShowMobileMenu(false)}>
              <span className="mobile-menu-icon">💬</span>
              <span>Messages</span>
            </Link>
            <Link to="/notifications" className="mobile-menu-item" onClick={() => setShowMobileMenu(false)}>
              <span className="mobile-menu-icon">🔔</span>
              <span>Notifications</span>
            </Link>
            <Link to="/bookmarks" className="mobile-menu-item" onClick={() => setShowMobileMenu(false)}>
              <span className="mobile-menu-icon">🔖</span>
              <span>Bookmarks</span>
            </Link>
            <Link to="/events" className="mobile-menu-item" onClick={() => setShowMobileMenu(false)}>
              <span className="mobile-menu-icon">📅</span>
              <span>Events</span>
            </Link>
            {user?.role && ['moderator', 'admin', 'super_admin'].includes(user.role) && (
              <Link to="/admin" className="mobile-menu-item" onClick={() => setShowMobileMenu(false)}>
                <span className="mobile-menu-icon">🛡️</span>
                <span>Admin Panel</span>
              </Link>
            )}
            <Link to="/settings" className="mobile-menu-item" onClick={() => setShowMobileMenu(false)}>
              <span className="mobile-menu-icon">⚙️</span>
              <span>Settings</span>
            </Link>
            <div className="mobile-menu-divider"></div>
            <DarkModeToggle />
            <div className="mobile-menu-divider"></div>
            <button onClick={() => { handleLogout(); setShowMobileMenu(false); }} className="mobile-menu-item mobile-menu-logout">
              <span className="mobile-menu-icon">🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>

        <div className="navbar-user" ref={dropdownRef}>
          {/* Main Navigation Buttons - PHASE 6: Rebranded labels */}
          <Link to="/feed" className="nav-button" title="Home">
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Home</span>
          </Link>
          {/* PHASE 2: Global and Following feeds */}
          <Link to="/feed/global" className="nav-button" title="Explore">
            <span className="nav-icon">🌍</span>
            <span className="nav-label">Explore</span>
          </Link>
          <Link to="/feed/following" className="nav-button" title="Community">
            <span className="nav-icon">👥</span>
            <span className="nav-label">Community</span>
          </Link>
          {/* PHASE 3: Journal and Longform */}
          <Link to="/journal" className="nav-button" title="Journal">
            <span className="nav-icon">📔</span>
            <span className="nav-label">Journal</span>
          </Link>
          <Link to="/longform" className="nav-button" title="Stories">
            <span className="nav-icon">📝</span>
            <span className="nav-label">Stories</span>
          </Link>
          {/* PHASE 4: Discover */}
          <Link to="/discover" className="nav-button" title="Discover">
            <span className="nav-icon">🌟</span>
            <span className="nav-label">Discover</span>
          </Link>
          {/* PHASE 1 REFACTOR: Connections link removed */}
          {/* <Link to="/connections" className="nav-button" title="Connections">
            <span className="nav-icon">👥</span>
            <span className="nav-label">Connections</span>
          </Link> */}
          <Link to="/messages" className="nav-button" title="Conversations">
            <span className="nav-icon">💬</span>
            <span className="nav-label">Conversations</span>
            {totalUnreadMessages > 0 && (
              <span className="nav-badge">{totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}</span>
            )}
          </Link>
          <NotificationBell />

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
              <Link to={`/profile/${user?.username}`} className="dropdown-item" onClick={() => setShowDropdown(false)}>
                <span className="dropdown-icon">👤</span>
                <span>My Profile</span>
              </Link>
              <Link to="/bookmarks" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                <span className="dropdown-icon">🔖</span>
                <span>Bookmarks</span>
              </Link>
              <Link to="/events" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                <span className="dropdown-icon">📅</span>
                <span>Events</span>
              </Link>
              <Link to="/settings" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                <span className="dropdown-icon">⚙️</span>
                <span>Settings</span>
              </Link>
              {user?.role && ['moderator', 'admin', 'super_admin'].includes(user.role) && (
                <Link to="/admin" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                  <span className="dropdown-icon">🛡️</span>
                  <span>Admin Panel</span>
                </Link>
              )}
              <div className="dropdown-item dropdown-dark-mode" onClick={toggleDarkMode}>
                <span className="dark-mode-icon">{isDark ? '☀️' : '🌙'}</span>
                <span>Dark Mode</span>
              </div>
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
