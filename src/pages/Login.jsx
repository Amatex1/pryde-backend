import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { setAuthToken, setCurrentUser, clearManualLogoutFlag } from '../utils/auth';
import { disconnectSocket, initializeSocket } from '../utils/socket';
import PasskeyLogin from '../components/PasskeyLogin';
import './Auth.css';

function Login({ setIsAuth }) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Apply user's dark mode preference
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  // Check if redirected due to expired token
  useEffect(() => {
    // Clear manual logout flag when login page loads
    clearManualLogoutFlag();

    if (searchParams.get('expired') === 'true') {
      setError('Your session has expired. Please log in again.');
    }
  }, [searchParams]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', formData);

      // Check if 2FA is required
      if (response.data.requires2FA) {
        setRequires2FA(true);
        setTempToken(response.data.tempToken);
        setError('');
        setLoading(false);
        return;
      }

      // Normal login (no 2FA)
      // Backend now returns accessToken instead of token (refresh token rotation)
      setAuthToken(response.data.accessToken || response.data.token);
      setCurrentUser(response.data.user);

      // Disconnect old socket and reconnect with new token
      disconnectSocket();
      const userId = response.data.user.id || response.data.user._id;
      initializeSocket(userId);

      setIsAuth(true);
      navigate('/feed');
    } catch (err) {
      console.error('Login error:', {
        status: err.response?.status,
        message: err.response?.data?.message,
        error: err.response?.data?.error,
        fullError: err
      });

      const errorMessage = err.response?.data?.message
        || err.message
        || 'Login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/verify-2fa-login', {
        tempToken,
        token: twoFactorCode
      });

      console.log('2FA verification successful:', response.data);

      // Backend now returns accessToken instead of token (refresh token rotation)
      setAuthToken(response.data.accessToken || response.data.token);
      setCurrentUser(response.data.user);

      // Disconnect old socket and reconnect with new token
      disconnectSocket();
      const userId = response.data.user.id || response.data.user._id;
      initializeSocket(userId);

      setIsAuth(true);
      navigate('/feed');
    } catch (err) {
      console.error('2FA verification error:', err);
      const errorMessage = err.response?.data?.message
        || 'Invalid verification code. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glossy fade-in">
        <div className="auth-header">
          <h1 className="auth-title text-shadow">✨ Pryde Social</h1>
          <p className="auth-subtitle">
            {requires2FA ? 'Enter your verification code' : 'Welcome back! Sign in to continue.'}
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* 2FA Verification Form */}
        {requires2FA ? (
          <form onSubmit={handleVerify2FA} className="auth-form">
            <div className="form-group">
              <label htmlFor="twoFactorCode">Two-Factor Authentication Code</label>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Enter the 6-digit code from your authenticator app or use a backup code.
              </p>
              <input
                type="text"
                id="twoFactorCode"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                className="form-input glossy"
                placeholder="000000"
                maxLength={6}
                autoFocus
                style={{
                  fontSize: '24px',
                  textAlign: 'center',
                  letterSpacing: '10px',
                  fontWeight: 'bold'
                }}
              />
            </div>

            <button type="submit" disabled={loading || twoFactorCode.length !== 6} className="btn-primary glossy-gold">
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>

            <button
              type="button"
              onClick={() => {
                setRequires2FA(false);
                setTempToken('');
                setTwoFactorCode('');
                setError('');
              }}
              className="btn-secondary"
              style={{ marginTop: '10px', width: '100%' }}
            >
              ← Back to Login
            </button>
          </form>
        ) : (
          // Normal Login Form
          <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="form-input glossy"
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="form-input glossy"
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
            <Link to="/forgot-password" className="auth-link" style={{ fontSize: '0.9rem' }}>
              Forgot password?
            </Link>
          </div>

          <button type="submit" disabled={loading} className="btn-primary glossy-gold">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <PasskeyLogin
            email={formData.email}
            onSuccess={(user) => {
              disconnectSocket();
              const userId = user.id || user._id;
              initializeSocket(userId);
              setIsAuth(true);
              navigate('/feed');
            }}
          />
        </form>
        )}

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register" className="auth-link">Sign up</Link></p>
          <div className="auth-legal-links">
            <Link to="/terms">Terms</Link>
            <span>•</span>
            <Link to="/privacy">Privacy</Link>
            <span>•</span>
            <Link to="/community">Guidelines</Link>
            <span>•</span>
            <Link to="/contact">Contact</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
