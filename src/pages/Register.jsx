import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import api from '../utils/api';
import { setAuthToken, setCurrentUser } from '../utils/auth';
import PasskeySetup from '../components/PasskeySetup';
import './Auth.css';

function Register({ setIsAuth }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    displayName: '',
    birthday: '',
    birthMonth: '',
    birthDay: '',
    birthYear: '',
    termsAccepted: false,
    isAlly: false // PHASE 6: Ally system
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasskeySetup, setShowPasskeySetup] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });
  const navigate = useNavigate();
  const captchaRef = useRef(null);
  const usernameCheckTimeout = useRef(null);

  // Apply user's dark mode preference
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  // Password strength calculator
  const calculatePasswordStrength = (password) => {
    if (!password) {
      return { score: 0, label: '', color: '' };
    }

    let score = 0;

    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]/.test(password)) score += 1;

    // Determine label and color
    if (score <= 2) {
      return { score, label: 'Weak', color: '#ff6b6b' };
    } else if (score <= 4) {
      return { score, label: 'Medium', color: '#ffa500' };
    } else if (score <= 6) {
      return { score, label: 'Strong', color: '#4caf50' };
    } else {
      return { score, label: 'Very Strong', color: '#0984E3' };
    }
  };

  // Username availability checker with debouncing
  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);

    try {
      const response = await api.get(`/auth/check-username/${username}`);
      setUsernameAvailable(response.data);
    } catch (error) {
      console.error('Username check error:', error);
      setUsernameAvailable({ available: false, message: 'Error checking username' });
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });

    // Check username availability with debouncing
    if (e.target.name === 'username') {
      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }

      usernameCheckTimeout.current = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 500); // Wait 500ms after user stops typing
    }

    // Calculate password strength
    if (e.target.name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate CAPTCHA
    if (!captchaToken) {
      setError('Please complete the CAPTCHA verification');
      return;
    }

    // Check username availability
    if (usernameAvailable && !usernameAvailable.available) {
      setError(usernameAvailable.message || 'Username is not available');
      return;
    }

    // Validate birthday dropdowns are all filled
    if (!formData.birthMonth || !formData.birthDay || !formData.birthYear) {
      setError('Please enter your full birthday');
      return;
    }

    // Construct birthday from dropdowns (YYYY-MM-DD format)
    const birthday = `${formData.birthYear}-${formData.birthMonth.padStart(2, '0')}-${formData.birthDay.padStart(2, '0')}`;

    // Calculate age from birthday
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Validate age is 18 or older
    if (age < 18) {
      setError('You must be 18 years or older to register');
      return;
    }

    // Update formData with constructed birthday
    formData.birthday = birthday;

    // Validate terms accepted
    if (!formData.termsAccepted) {
      setError('You must accept the terms to register');
      return;
    }

    // Frontend validation
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Validate password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(formData.password)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      console.log('Attempting registration with:', {
        username: formData.username,
        email: formData.email,
        displayName: formData.displayName
      });

      const response = await api.post('/auth/signup', {
        ...formData,
        captchaToken
      });
      
      console.log('Registration successful:', response.data);
      
      setAuthToken(response.data.token);
      setCurrentUser(response.data.user);
      setIsAuth(true);

      // Show passkey setup option
      setShowPasskeySetup(true);
    } catch (err) {
      console.error('Registration error:', {
        status: err.response?.status,
        message: err.response?.data?.message,
        error: err.response?.data?.error,
        fullError: err
      });

      const errorMessage = err.response?.data?.message
        || err.message
        || 'Registration failed. Please try again.';
      setError(errorMessage);

      // Reset CAPTCHA on error
      if (captchaRef.current) {
        captchaRef.current.resetCaptcha();
        setCaptchaToken('');
      }
    } finally {
      setLoading(false);
    }
  };

  const onCaptchaVerify = (token) => {
    setCaptchaToken(token);
  };

  const onCaptchaExpire = () => {
    setCaptchaToken('');
  };

  return (
    <div className="auth-container">
      <div className="auth-card glossy fade-in">
        <div className="auth-header">
          <h1 className="auth-title text-shadow">✨ Pryde Social</h1>
          <p className="auth-subtitle">
            {showPasskeySetup ? 'Secure Your Account' : 'Create your account and start connecting!'}
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {showPasskeySetup ? (
          <div className="passkey-setup-container">
            <div className="passkey-setup-info">
              <h3>🎉 Account Created Successfully!</h3>
              <p>Add a passkey for faster, more secure sign-in</p>
            </div>

            <PasskeySetup
              onSuccess={() => {
                navigate('/feed');
              }}
            />

            <button
              onClick={() => navigate('/feed')}
              className="btn-secondary"
              style={{ marginTop: '1rem', width: '100%' }}
            >
              Skip for Now
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className="form-input glossy"
              placeholder="Choose a username"
              autoComplete="username"
            />
            {formData.username.length >= 3 && (
              <div className="username-feedback" style={{
                marginTop: '0.5rem',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                {checkingUsername ? (
                  <span style={{ color: 'var(--text-muted)' }}>⏳ Checking availability...</span>
                ) : usernameAvailable ? (
                  usernameAvailable.available ? (
                    <span style={{ color: '#4caf50', fontWeight: '600' }}>✓ {usernameAvailable.message}</span>
                  ) : (
                    <span style={{ color: '#ff6b6b', fontWeight: '600' }}>✗ {usernameAvailable.message}</span>
                  )
                ) : null}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              className="form-input glossy"
              placeholder="Your display name (optional)"
              autoComplete="name"
            />
          </div>

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
              minLength="8"
              className="form-input glossy"
              placeholder="Create a password (min 8 characters)"
              autoComplete="new-password"
            />
            {formData.password && (
              <div className="password-strength" style={{ marginTop: '0.75rem' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Password Strength:
                  </span>
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: passwordStrength.color
                  }}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: 'var(--bg-subtle)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(passwordStrength.score / 7) * 100}%`,
                    height: '100%',
                    background: passwordStrength.color,
                    transition: 'all 0.3s ease',
                    borderRadius: '3px'
                  }} />
                </div>
              </div>
            )}
            <small style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>
              Must contain at least one uppercase letter, one lowercase letter, and one number
            </small>
          </div>

          <div className="form-group">
            <label>Birthday <span style={{ color: 'var(--pryde-purple)', fontWeight: 'bold' }}>*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: '0.75rem' }}>
              <select
                name="birthMonth"
                value={formData.birthMonth}
                onChange={handleChange}
                required
                className="form-input glossy"
                style={{ padding: '0.75rem' }}
              >
                <option value="">Month</option>
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
              <select
                name="birthDay"
                value={formData.birthDay}
                onChange={handleChange}
                required
                className="form-input glossy"
                style={{ padding: '0.75rem' }}
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              <select
                name="birthYear"
                value={formData.birthYear}
                onChange={handleChange}
                required
                className="form-input glossy"
                style={{ padding: '0.75rem' }}
              >
                <option value="">Year</option>
                {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 18 - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
              You must be 18 or older to register. Only your age will be shown on your profile.
            </small>
          </div>

          <div className="form-group checkbox-group" style={{ display: 'none' }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="ageVerified"
                checked={true}
                onChange={handleChange}
              />
              <span className="checkbox-text">
                I verify that I am 18 years or older
              </span>
            </label>
          </div>

          {/* PHASE 6: Ally Selection */}
          <div className="form-group" style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--soft-lavender)', borderRadius: '8px' }}>
            <label style={{ fontWeight: 'bold', color: 'var(--pryde-purple)', marginBottom: '0.75rem', display: 'block' }}>
              🌈 How do you identify on Pryde?
            </label>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.5' }}>
              Pryde is a calm, queer-first creative platform for LGBTQ+ introverts, deep thinkers, and supportive allies.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label className="checkbox-label" style={{
                padding: '0.75rem',
                background: formData.isAlly === false ? 'var(--pryde-purple)' : 'var(--card-surface)',
                color: formData.isAlly === false ? 'white' : 'var(--text-main)',
                border: formData.isAlly === false ? '2px solid var(--pryde-purple)' : '2px solid var(--border-light)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}>
                <input
                  type="radio"
                  name="identityType"
                  checked={formData.isAlly === false}
                  onChange={() => setFormData({ ...formData, isAlly: false })}
                  style={{ marginRight: '0.5rem' }}
                />
                <span>I am LGBTQ+</span>
              </label>
              <label className="checkbox-label" style={{
                padding: '0.75rem',
                background: formData.isAlly === true ? 'var(--pryde-purple)' : 'var(--card-surface)',
                color: formData.isAlly === true ? 'white' : 'var(--text-main)',
                border: formData.isAlly === true ? '2px solid var(--pryde-purple)' : '2px solid var(--border-light)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}>
                <input
                  type="radio"
                  name="identityType"
                  checked={formData.isAlly === true}
                  onChange={() => setFormData({ ...formData, isAlly: true })}
                  style={{ marginRight: '0.5rem' }}
                />
                <span>I am an ally and agree to respect queer spaces</span>
              </label>
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="termsAccepted"
                checked={formData.termsAccepted}
                onChange={handleChange}
                required
              />
              <span className="checkbox-text">
                I agree to the <a href="/terms" target="_blank" className="auth-link">Terms of Service</a> and <a href="/privacy" target="_blank" className="auth-link">Privacy Policy</a>
              </span>
            </label>
          </div>

          {/* hCaptcha */}
          <div className="form-group" style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '1.5rem',
            marginBottom: '1rem'
          }}>
            <HCaptcha
              ref={captchaRef}
              sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001'}
              onVerify={onCaptchaVerify}
              onExpire={onCaptchaExpire}
              theme={document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !formData.birthMonth || !formData.birthDay || !formData.birthYear || !formData.termsAccepted || !captchaToken}
            className="btn-primary glossy-gold"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        )}

        {!showPasskeySetup && (
          <div className="auth-footer">
          <p>Already have an account? <Link to="/login" className="auth-link">Sign in</Link></p>
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
        )}
      </div>
    </div>
  );
}

export default Register;
