import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { isAuthenticated, getCurrentUser } from './utils/auth';
import { initializeSocket, disconnectSocket, onNewMessage } from './utils/socket';
import { playNotificationSound, requestNotificationPermission } from './utils/notifications';
import { initializeQuietMode } from './utils/quietMode';
import api from './utils/api';

// Eager load critical components (needed immediately)
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Footer from './components/Footer';
import SafetyWarning from './components/SafetyWarning';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import CookieBanner from './components/CookieBanner';

// Lazy load non-critical pages (loaded on demand)
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Feed = lazy(() => import('./pages/Feed'));
const GlobalFeed = lazy(() => import('./pages/GlobalFeed'));
const FollowingFeed = lazy(() => import('./pages/FollowingFeed'));
const Journal = lazy(() => import('./pages/Journal'));
const Longform = lazy(() => import('./pages/Longform'));
const Discover = lazy(() => import('./pages/Discover'));
const TagFeed = lazy(() => import('./pages/TagFeed'));
const PhotoEssay = lazy(() => import('./pages/PhotoEssay'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const SecuritySettings = lazy(() => import('./pages/SecuritySettings'));
const PrivacySettings = lazy(() => import('./pages/PrivacySettings'));
const Bookmarks = lazy(() => import('./pages/Bookmarks'));
const Events = lazy(() => import('./pages/Events'));
const Messages = lazy(() => import('./pages/Messages'));
const Lounge = lazy(() => import('./pages/Lounge'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Admin = lazy(() => import('./pages/Admin'));
const Hashtag = lazy(() => import('./pages/Hashtag'));

// Lazy load legal pages
const Terms = lazy(() => import('./pages/legal/Terms'));
const Privacy = lazy(() => import('./pages/legal/Privacy'));
const Community = lazy(() => import('./pages/legal/Community'));
const Safety = lazy(() => import('./pages/legal/Safety'));
const Security = lazy(() => import('./pages/legal/Security'));
const Contact = lazy(() => import('./pages/legal/Contact'));
const FAQ = lazy(() => import('./pages/legal/FAQ'));
const LegalRequests = lazy(() => import('./pages/legal/LegalRequests'));
const DMCA = lazy(() => import('./pages/legal/DMCA'));
const AcceptableUse = lazy(() => import('./pages/legal/AcceptableUse'));
const CookiePolicy = lazy(() => import('./pages/legal/CookiePolicy'));
const Helplines = lazy(() => import('./pages/legal/Helplines'));

// Loading fallback component
const PageLoader = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'var(--bg-light)',
    color: 'var(--text-main)'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '4px solid var(--pryde-purple)',
        borderTop: '4px solid transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 1rem'
      }}></div>
      <p>Loading...</p>
    </div>
  </div>
);

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

        <Suspense fallback={<PageLoader />}>
          <main id="main-content">
            <Routes>
            {/* Public Home Page - Redirect to feed if logged in */}
            <Route path="/" element={!isAuth ? <Home /> : <Navigate to="/feed" />} />

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
          <Route path="/lounge" element={<PrivateRoute><Lounge /></PrivateRoute>} />
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
          </main>
        </Suspense>

        {/* PWA Install Prompt */}
        {isAuth && <PWAInstallPrompt />}

        {/* Cookie Banner */}
        <CookieBanner />
      </div>
    </Router>
  );
}

export default App;
