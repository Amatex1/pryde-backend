import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import SecuritySettings from './pages/SecuritySettings';
import PrivacySettings from './pages/PrivacySettings';
import Bookmarks from './pages/Bookmarks';
import Friends from './pages/Friends';
import Messages from './pages/Messages';
import Admin from './pages/Admin';
import Hashtag from './pages/Hashtag';
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import Community from './pages/legal/Community';
import Safety from './pages/legal/Safety';
import Contact from './pages/legal/Contact';
import FAQ from './pages/legal/FAQ';
import LegalRequests from './pages/legal/LegalRequests';
import DMCA from './pages/legal/DMCA';
import AcceptableUse from './pages/legal/AcceptableUse';
import CookiePolicy from './pages/legal/CookiePolicy';
import Helplines from './pages/legal/Helplines';
import Footer from './components/Footer';
import MiniChat from './components/MiniChat';
import SafetyWarning from './components/SafetyWarning';
import { isAuthenticated, getCurrentUser } from './utils/auth';
import { initializeSocket, disconnectSocket, onNewMessage } from './utils/socket';
import { playNotificationSound, requestNotificationPermission } from './utils/notifications';

function App() {
  const [isAuth, setIsAuth] = useState(isAuthenticated());
  const [openChats, setOpenChats] = useState([]);
  const [minimizedChats, setMinimizedChats] = useState([]);

  useEffect(() => {
    setIsAuth(isAuthenticated());

    // Initialize Socket.IO when user is authenticated
    if (isAuthenticated()) {
      const user = getCurrentUser();
      if (user && (user.id || user._id)) {
        initializeSocket(user.id || user._id);

        // Request notification permission
        requestNotificationPermission();

        // Listen for new messages and play sound
        onNewMessage((msg) => {
          playNotificationSound();
        });
      }

      // Cleanup on unmount or when user logs out
      return () => {
        if (!isAuthenticated()) {
          disconnectSocket();
        }
      };
    }
  }, [isAuth]);

  // Open a mini chat
  const openMiniChat = (friendIdOrObject, friendName, friendPhoto) => {
    // Handle both object and individual parameters
    let friendId, name, photo;

    if (typeof friendIdOrObject === 'object' && friendIdOrObject !== null) {
      // Called with friend object
      friendId = friendIdOrObject._id || friendIdOrObject.id;
      name = friendIdOrObject.displayName || friendIdOrObject.username;
      photo = friendIdOrObject.profilePhoto;
    } else {
      // Called with individual parameters
      friendId = friendIdOrObject;
      name = friendName;
      photo = friendPhoto;
    }

    // Check if chat is already open
    const existingChat = openChats.find(chat => chat.friendId === friendId);
    if (existingChat) {
      // If minimized, restore it
      setMinimizedChats(prev => prev.filter(id => id !== friendId));
      return;
    }

    // Add new chat
    setOpenChats(prev => [...prev, { friendId, friendName: name, friendPhoto: photo }]);
  };

  // Close a mini chat
  const closeMiniChat = (friendId) => {
    setOpenChats(prev => prev.filter(chat => chat.friendId !== friendId));
    setMinimizedChats(prev => prev.filter(id => id !== friendId));
  };

  // Toggle minimize/maximize
  const toggleMinimize = (friendId) => {
    setMinimizedChats(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      } else {
        return [...prev, friendId];
      }
    });
  };

  const PrivateRoute = ({ children }) => {
    return isAuth ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
      <div className="app-container">
        {/* Safety Warning for high-risk regions */}
        {isAuth && <SafetyWarning />}

        <Routes>
          {/* Public Home Page */}
          <Route path="/" element={<Home onOpenMiniChat={openMiniChat} />} />

          {/* Auth Pages */}
          <Route path="/login" element={!isAuth ? <Login setIsAuth={setIsAuth} /> : <Navigate to="/feed" />} />
          <Route path="/register" element={!isAuth ? <Register setIsAuth={setIsAuth} /> : <Navigate to="/feed" />} />
          <Route path="/forgot-password" element={!isAuth ? <ForgotPassword /> : <Navigate to="/feed" />} />
          <Route path="/reset-password" element={!isAuth ? <ResetPassword /> : <Navigate to="/feed" />} />

          {/* Protected Routes */}
          <Route path="/feed" element={<PrivateRoute><Feed onOpenMiniChat={openMiniChat} /></PrivateRoute>} />
          <Route path="/profile/:id" element={<PrivateRoute><Profile onOpenMiniChat={openMiniChat} /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings onOpenMiniChat={openMiniChat} /></PrivateRoute>} />
          <Route path="/settings/security" element={<PrivateRoute><SecuritySettings onOpenMiniChat={openMiniChat} /></PrivateRoute>} />
          <Route path="/settings/privacy" element={<PrivateRoute><PrivacySettings onOpenMiniChat={openMiniChat} /></PrivateRoute>} />
          <Route path="/bookmarks" element={<PrivateRoute><Bookmarks onOpenMiniChat={openMiniChat} /></PrivateRoute>} />
          <Route path="/friends" element={<PrivateRoute><Friends onOpenMiniChat={openMiniChat} /></PrivateRoute>} />
          <Route path="/messages" element={<PrivateRoute><Messages onOpenMiniChat={openMiniChat} /></PrivateRoute>} />
          <Route path="/hashtag/:tag" element={<PrivateRoute><Hashtag onOpenMiniChat={openMiniChat} /></PrivateRoute>} />

          {/* Admin Panel - Hidden Route (requires admin role) */}
          <Route path="/admin" element={<PrivateRoute><Admin onOpenMiniChat={openMiniChat} /></PrivateRoute>} />

          {/* Legal Pages - Public Access */}
          <Route path="/terms" element={<><Terms /><Footer /></>} />
          <Route path="/privacy" element={<><Privacy /><Footer /></>} />
          <Route path="/community" element={<><Community /><Footer /></>} />
          <Route path="/community-guidelines" element={<><Community /><Footer /></>} />
          <Route path="/safety" element={<><Safety /><Footer /></>} />
          <Route path="/contact" element={<><Contact /><Footer /></>} />
          <Route path="/faq" element={<><FAQ /><Footer /></>} />
          <Route path="/legal-requests" element={<><LegalRequests /><Footer /></>} />
          <Route path="/dmca" element={<><DMCA /><Footer /></>} />
          <Route path="/acceptable-use" element={<><AcceptableUse /><Footer /></>} />
          <Route path="/cookie-policy" element={<><CookiePolicy /><Footer /></>} />
          <Route path="/helplines" element={<><Helplines /><Footer /></>} />
        </Routes>

        {/* Mini Chat Boxes */}
        {isAuth && (
          <div className="mini-chats-container">
            {openChats.map((chat, index) => (
              <div
                key={chat.friendId}
                style={{
                  right: `${20 + (index * 340)}px`,
                }}
              >
                <MiniChat
                  friendId={chat.friendId}
                  friendName={chat.friendName}
                  friendPhoto={chat.friendPhoto}
                  onClose={() => closeMiniChat(chat.friendId)}
                  onMinimize={() => toggleMinimize(chat.friendId)}
                  isMinimized={minimizedChats.includes(chat.friendId)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;
