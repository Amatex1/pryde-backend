import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, logout } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import OnlinePresence from './OnlinePresence';
import './Navbar.css';

function Navbar() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleLogout = () => {
    logout();
    navigate('/login');
    window.location.reload();
  };

  return (
    <nav className="navbar glossy">
      <div className="navbar-container">
        <Link to="/feed" className="navbar-brand">
          <span className="brand-icon">✨</span>
          <span className="brand-text">Pryde Social</span>
        </Link>
        
        <div className="navbar-links">
          <Link to="/feed" className="nav-link">
            <span className="nav-icon">🏠</span>
            <span className="nav-text">Feed</span>
          </Link>
          <Link to="/friends" className="nav-link">
            <span className="nav-icon">👥</span>
            <span className="nav-text">Friends</span>
          </Link>
          <Link to="/messages" className="nav-link">
            <span className="nav-icon">💬</span>
            <span className="nav-text">Messages</span>
          </Link>
          <Link to={`/profile/${user?.id}`} className="nav-link">
            <span className="nav-icon">👤</span>
            <span className="nav-text">Profile</span>
          </Link>
          <Link to="/settings" className="nav-link">
            <span className="nav-icon">⚙️</span>
            <span className="nav-text">Settings</span>
          </Link>
          <button onClick={handleLogout} className="nav-link logout-btn">
            <span className="nav-icon">🚪</span>
            <span className="nav-text">Logout</span>
          </button>
        </div>

        <div className="navbar-user">
          <OnlinePresence />
          <div className="user-avatar">
            {user?.profilePhoto ? (
              <img src={getImageUrl(user.profilePhoto)} alt={user.username} />
            ) : (
              <span>{user?.username?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <span className="user-name">{user?.displayName || user?.username}</span>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
