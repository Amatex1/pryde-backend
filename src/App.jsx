import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Feed from './pages/Feed';
import GlobalFeed from './pages/GlobalFeed'; // PHASE 2: Global feed
import FollowingFeed from './pages/FollowingFeed'; // PHASE 2: Following feed
import Journal from './pages/Journal'; // PHASE 3: Journaling
import Longform from './pages/Longform'; // PHASE 3: Longform posts
import Discover from './pages/Discover'; // PHASE 4: Community tags
import TagFeed from './pages/TagFeed'; // PHASE 4: Tag feed
import PhotoEssay from './pages/PhotoEssay'; // OPTIONAL: Photo essay creation
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import SecuritySettings from './pages/SecuritySettings';
import PrivacySettings from './pages/PrivacySettings';
import Bookmarks from './pages/Bookmarks';
import Events from './pages/Events';
// PHASE 1 REFACTOR: Friends page removed
// import Friends from './pages/Friends';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import Admin from './pages/Admin';
import Hashtag from './pages/Hashtag';
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import Community from './pages/legal/Community';
import Safety from './pages/legal/Safety';
import Security from './pages/legal/Security';
import Contact from './pages/legal/Contact';
import FAQ from './pages/legal/FAQ';
import LegalRequests from './pages/legal/LegalRequests';
import DMCA from './pages/legal/DMCA';
import AcceptableUse from './pages/legal/AcceptableUse';
import CookiePolicy from './pages/legal/CookiePolicy';
import Helplines from './pages/legal/Helplines';
import Footer from './components/Footer';
import SafetyWarning from './components/SafetyWarning';
import { isAuthenticated, getCurrentUser } from './utils/auth';
import { initializeSocket, disconnectSocket, onNewMessage } from './utils/socket';
import { playNotificationSound, requestNotificationPermission } from './utils/notifications';
import { initializeQuietMode } from './utils/quietMode';
import api from './utils/api';

function App() {
  const [isAuth, setIsAuth] = useState(isAuthenticated());

  useEffect(() => {
    setIsAuth(isAuthenticated());

    // Initialize Quiet Mode globally
    const initQuietMode = async () => {
      if (isAuthenticated()) {
        try {
          const response = await api.get('/auth/me');
          const user = response.data;

          // Initialize quiet mode with user settings
          initializeQuietMode(user);
        } catch (error) {
          console.error('Failed to initialize quiet mode:', error);
        }
      }
    };

    initQuietMode();

    // Initialize Socket.IO when user is authenticated
    if (isAuthenticated()) {
      const user = getCurrentUser();
      if (user && (user.id || user._id)) {
        initializeSocket(user.id || user._id);

        // Request notification permission
        requestNotificationPermission();

        // Listen for new messages and play sound
        const cleanupNewMessage = onNewMessage((msg) => {
          playNotificationSound();
        });

        // Cleanup on unmount or when user logs out
        return () => {
          cleanupNewMessage?.();
          if (!isAuthenticated()) {
            disconnectSocket();
          }
        };
      }
    }
  }, [isAuth]);

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
          <Route path="/" element={<Home />} />

          {/* Auth Pages */}
          <Route path="/login" element={!isAuth ? <Login setIsAuth={setIsAuth} /> : <Navigate to="/feed" />} />
          <Route path="/register" element={!isAuth ? <Register setIsAuth={setIsAuth} /> : <Navigate to="/feed" />} />
          <Route path="/forgot-password" element={!isAuth ? <ForgotPassword /> : <Navigate to="/feed" />} />
          <Route path="/reset-password" element={!isAuth ? <ResetPassword /> : <Navigate to="/feed" />} />

          {/* Protected Routes */}
          <Route path="/feed" element={<PrivateRoute><Feed /></PrivateRoute>} />
          <Route path="/feed/global" element={<PrivateRoute><GlobalFeed /></PrivateRoute>} /> {/* PHASE 2 */}
          <Route path="/feed/following" element={<PrivateRoute><FollowingFeed /></PrivateRoute>} /> {/* PHASE 2 */}
          <Route path="/journal" element={<PrivateRoute><Journal /></PrivateRoute>} /> {/* PHASE 3 */}
          <Route path="/longform" element={<PrivateRoute><Longform /></PrivateRoute>} /> {/* PHASE 3 */}
          <Route path="/discover" element={<PrivateRoute><Discover /></PrivateRoute>} /> {/* PHASE 4 */}
          <Route path="/tags/:slug" element={<PrivateRoute><TagFeed /></PrivateRoute>} /> {/* PHASE 4 */}
          <Route path="/photo-essay" element={<PrivateRoute><PhotoEssay /></PrivateRoute>} /> {/* OPTIONAL */}
          <Route path="/photo-essay/:id" element={<PrivateRoute><PhotoEssay /></PrivateRoute>} /> {/* OPTIONAL */}
          <Route path="/profile/:id" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/settings/security" element={<PrivateRoute><SecuritySettings /></PrivateRoute>} />
          <Route path="/settings/privacy" element={<PrivateRoute><PrivacySettings /></PrivateRoute>} />
          <Route path="/bookmarks" element={<PrivateRoute><Bookmarks /></PrivateRoute>} />
          <Route path="/events" element={<PrivateRoute><Events /></PrivateRoute>} />
          {/* PHASE 1 REFACTOR: Friends/Connections routes removed */}
          {/* <Route path="/connections" element={<PrivateRoute><Friends /></PrivateRoute>} /> */}
          {/* <Route path="/friends" element={<PrivateRoute><Friends /></PrivateRoute>} /> */}
          <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/hashtag/:tag" element={<PrivateRoute><Hashtag /></PrivateRoute>} />

          {/* Admin Panel - Hidden Route (requires admin role) */}
          <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />

          {/* Legal Pages - Public Access */}
          <Route path="/terms" element={<><Terms /><Footer /></>} />
          <Route path="/privacy" element={<><Privacy /><Footer /></>} />
          <Route path="/community" element={<><Community /><Footer /></>} />
          <Route path="/community-guidelines" element={<><Community /><Footer /></>} />
          <Route path="/safety" element={<><Safety /><Footer /></>} />
          <Route path="/security" element={<><Security /><Footer /></>} />
          <Route path="/contact" element={<><Contact /><Footer /></>} />
          <Route path="/faq" element={<><FAQ /><Footer /></>} />
          <Route path="/legal-requests" element={<><LegalRequests /><Footer /></>} />
          <Route path="/dmca" element={<><DMCA /><Footer /></>} />
          <Route path="/acceptable-use" element={<><AcceptableUse /><Footer /></>} />
          <Route path="/cookie-policy" element={<><CookiePolicy /><Footer /></>} />
          <Route path="/helplines" element={<><Helplines /><Footer /></>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
