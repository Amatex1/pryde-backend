import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { getCurrentUser, logout } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import DarkModeToggle from './DarkModeToggle';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import api from '../utils/api';
import './Navbar.css';

function Navbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  const handleLogout = () => {
    logout();
    // Use navigate for SPA navigation without page refresh
    navigate('/login');
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
                <Link to={`/profile/${user?.id}`} className="mobile-menu-view-profile" onClick={() => setShowMobileMenu(false)}>
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
          <DarkModeToggle />
          {/* Admin Panel Button - Only visible to moderators, admins, and super admins */}
          {user?.role && ['moderator', 'admin', 'super_admin'].includes(user.role) && (
            <Link to="/admin" className="admin-button" title="Admin Panel">
              🛡️
            </Link>
          )}
          <NotificationBell />
          <Link to="/messages" className="messages-button" title="Messages">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2H4C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM18 14H6V12H18V14ZM18 11H6V9H18V11ZM18 8H6V6H18V8Z" fill="currentColor"/>
            </svg>
            {totalUnreadMessages > 0 && (
              <span className="message-badge">{totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}</span>
            )}
          </Link>
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
              <Link to="/connections" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                <span className="dropdown-icon">👥</span>
                <span>Connections</span>
              </Link>
              <Link to={`/profile/${user?.id}`} className="dropdown-item" onClick={() => setShowDropdown(false)}>
                <span className="dropdown-icon">👤</span>
                <span>Profile</span>
              </Link>
              <Link to="/bookmarks" className="dropdown-item" onClick={() => setShowDropdown(false)}>
                <span className="dropdown-icon">🔖</span>
                <span>Bookmarks</span>
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
