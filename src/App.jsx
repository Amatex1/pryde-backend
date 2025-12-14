import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { isAuthenticated, getCurrentUser } from './utils/auth';
import { initializeSocket, disconnectSocket, onNewMessage } from './utils/socket';
import { playNotificationSound, requestNotificationPermission } from './utils/notifications';
import { initializeQuietMode } from './utils/quietMode';
import api from './utils/api';
import logger from './utils/logger';

// Eager load critical components (needed immediately)
// IMPORTANT: Only load components that DON'T use React Router hooks
import SafetyWarning from './components/SafetyWarning';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import CookieBanner from './components/CookieBanner';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load ALL pages (including Home, Login, Register) to avoid Router context errors
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Footer = lazy(() => import('./components/Footer'));
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

// Loading fallback component with timeout
const PageLoader = () => {
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    // If loading takes more than 10 seconds, show reload button
    const timeout = setTimeout(() => {
      setShowReload(true);
    }, 10000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#f7f7f7', // Hardcoded fallback color
      color: '#2b2b2b'
    }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #6C5CE7',
          borderTop: '4px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }}></div>
        <p style={{ marginBottom: '1rem' }}>Loading...</p>

        {showReload && (
          <div style={{ marginTop: '2rem' }}>
            <p style={{
              marginBottom: '1rem',
              color: '#616161',
              fontSize: '0.9rem'
            }}>
              Taking longer than expected...
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                border: '2px solid #6C5CE7',
                background: '#6C5CE7',
                color: 'white',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  const [isAuth, setIsAuth] = useState(isAuthenticated());
  const [initError, setInitError] = useState(false);

  useEffect(() => {
    setIsAuth(isAuthenticated());

    // Initialize Quiet Mode globally with retry logic
    const initQuietMode = async (retries = 3) => {
      if (isAuthenticated()) {
        try {
          const response = await api.get('/auth/me', {
            timeout: 10000 // 10 second timeout
          });
          const user = response.data;

          // Initialize quiet mode with user settings
          initializeQuietMode(user);
          setInitError(false);
        } catch (error) {
          logger.error('Failed to initialize quiet mode:', error);

          // Retry if we have retries left
          if (retries > 0) {
            logger.debug(`Retrying quiet mode initialization... (${retries} retries left)`);
            setTimeout(() => initQuietMode(retries - 1), 2000);
          } else {
            logger.warn('Quiet mode initialization failed after all retries');
            // Don't block the app - just use default settings
            setInitError(true);
          }
        }
      }
    };

    initQuietMode();

    // Initialize Socket.IO when user is authenticated with timeout
    if (isAuthenticated()) {
      const user = getCurrentUser();
      if (user && (user.id || user._id)) {
        try {
          initializeSocket(user.id || user._id);

          // Request notification permission (non-blocking)
          requestNotificationPermission().catch(err => {
            logger.warn('Notification permission request failed:', err);
          });

          // Listen for new messages and play sound
          const cleanupNewMessage = onNewMessage((msg) => {
            playNotificationSound().catch(err => {
              logger.warn('Failed to play notification sound:', err);
            });
          });

          // Cleanup on unmount or when user logs out
          return () => {
            cleanupNewMessage?.();
            if (!isAuthenticated()) {
              disconnectSocket();
            }
          };
        } catch (error) {
          logger.error('Socket initialization failed:', error);
          // Don't block the app - socket features just won't work
        }
      }
    }
  }, [isAuth]);

  const PrivateRoute = ({ children }) => {
    return isAuth ? children : <Navigate to="/login" />;
  };

  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <div className="app-container">
            {/* Safety Warning for high-risk regions */}
            {isAuth && <SafetyWarning />}

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

          {/* PWA Install Prompt */}
          {isAuth && <PWAInstallPrompt />}

          {/* Cookie Banner */}
          <CookieBanner />
        </div>
      </Suspense>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
