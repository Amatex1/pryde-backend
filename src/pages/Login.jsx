import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { setAuthToken, setRefreshToken, setCurrentUser, clearManualLogoutFlag } from '../utils/auth';
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
      setError('Your session timed out. You can sign in again when ready.');
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
      setRefreshToken(response.data.refreshToken); // Store refresh token
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
        || 'That didn't work. You can try again in a moment.';
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
      setRefreshToken(response.data.refreshToken); // Store refresh token
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
        || 'That code didn't match. You can try again.';
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
            {requires2FA ? 'Enter your verification code' : 'Sign in'}
          </p>
          {!requires2FA && (
            <p className="auth-subtext">Take your time.</p>
          )}
        </div>

        {error && (
          <div
            id="login-error"
            className="error-message"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        {/* 2FA Verification Form */}
        {requires2FA ? (
          <form onSubmit={handleVerify2FA} className="auth-form">
            <div className="form-group">
              <label htmlFor="twoFactorCode">Verification code</label>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                This is the 6-digit code from your authenticator app, or a backup code.
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
                  fontSize: 'var(--font-size-2xl)',
                  textAlign: 'center',
                  letterSpacing: '10px',
                  fontWeight: 'bold'
                }}
              />
            </div>

            <button type="submit" disabled={loading || twoFactorCode.length !== 6} className="btn-primary glossy-gold">
              {loading ? 'Verifying…' : 'Verify code'}
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
              style={{ marginTop: 'var(--space-sm)', width: '100%' }}
            >
              ← Back
            </button>
          </form>
        ) : (
          // Normal Login Form
          <form onSubmit={handleSubmit} className="auth-form" aria-label="Login form">
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
              placeholder="Your email"
              autoComplete="email"
              aria-required="true"
              aria-invalid={error && error.toLowerCase().includes('email') ? 'true' : 'false'}
              aria-describedby={error && error.toLowerCase().includes('email') ? 'login-error' : undefined}
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
              placeholder="Your password"
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={error && error.toLowerCase().includes('password') ? 'true' : 'false'}
              aria-describedby={error && error.toLowerCase().includes('password') ? 'login-error' : undefined}
            />
            <div className="forgot-password-link">
              <Link to="/forgot-password" className="auth-link-muted">
                Forgot password?
              </Link>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary glossy-gold">
            {loading ? 'Signing in…' : 'Sign in'}
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
            <Link to="/safety">Safety</Link>
            <span>•</span>
            <Link to="/contact">Contact</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
