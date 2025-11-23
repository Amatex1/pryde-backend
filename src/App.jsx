import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Friends from './pages/Friends';
import Messages from './pages/Messages';
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import Community from './pages/legal/Community';
import Safety from './pages/legal/Safety';
import Contact from './pages/legal/Contact';
import Footer from './components/Footer';
import { isAuthenticated, getCurrentUser } from './utils/auth';
import { initializeSocket, disconnectSocket } from './utils/socket';

function App() {
  const [isAuth, setIsAuth] = useState(isAuthenticated());

  useEffect(() => {
    setIsAuth(isAuthenticated());

    // Initialize Socket.IO when user is authenticated
    if (isAuthenticated()) {
      const user = getCurrentUser();
      if (user && (user.id || user._id)) {
        initializeSocket(user.id || user._id);
      }

      // Cleanup on unmount or when user logs out
      return () => {
        if (!isAuthenticated()) {
          disconnectSocket();
        }
      };
    }
  }, [isAuth]);

  const PrivateRoute = ({ children }) => {
    return isAuth ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/login" element={!isAuth ? <Login setIsAuth={setIsAuth} /> : <Navigate to="/feed" />} />
          <Route path="/register" element={!isAuth ? <Register setIsAuth={setIsAuth} /> : <Navigate to="/feed" />} />
          <Route path="/feed" element={<PrivateRoute><Feed /></PrivateRoute>} />
          <Route path="/profile/:id" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/friends" element={<PrivateRoute><Friends /></PrivateRoute>} />
          <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
          
          {/* Legal Pages - Public Access */}
          <Route path="/terms" element={<><Terms /><Footer /></>} />
          <Route path="/privacy" element={<><Privacy /><Footer /></>} />
          <Route path="/community" element={<><Community /><Footer /></>} />
          <Route path="/safety" element={<><Safety /><Footer /></>} />
          <Route path="/contact" element={<><Contact /><Footer /></>} />
          
          <Route path="/" element={<Navigate to="/feed" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
