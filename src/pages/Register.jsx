import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import api from '../utils/api';
import { setAuthToken, setRefreshToken, setCurrentUser } from '../utils/auth';
import PasskeySetup from '../components/PasskeySetup';
import './Auth.css';

function Register({ setIsAuth }) {
  const [formData, setFormData] = useState({
    // Required fields
    fullName: '',
    username: '',
    email: '',
    password: '',
    birthMonth: '',
    birthDay: '',
    birthYear: '',
    birthday: '',
    termsAccepted: false,
    // Optional fields
    displayName: '',
    identity: '', // 'LGBTQ+' or 'Ally'
    pronouns: '',
    bio: ''
  });
  const [skipOptional, setSkipOptional] = useState(false);
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

    // Frontend validation - must match backend requirements (12 characters minimum)
    if (formData.password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    // Validate password complexity - must match backend requirements
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/])/;
    if (!passwordRegex.test(formData.password)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
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

      // Backend now returns accessToken instead of token (refresh token rotation)
      setAuthToken(response.data.accessToken || response.data.token);
      setRefreshToken(response.data.refreshToken); // Store refresh token
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
            {showPasskeySetup ? 'Secure Your Account' : 'Join a queer-centred space built for safety, connection, and authenticity'}
          </p>
          {!showPasskeySetup && (
            <div style={{
              background: 'var(--soft-lavender)',
              border: '2px solid var(--pryde-purple)',
              borderRadius: 'var(--border-radius-md)',
              padding: 'var(--space-md)',
              marginTop: 'var(--space-md)',
              fontSize: 'var(--font-size-sm)',
              lineHeight: 'var(--line-height-relaxed)'
            }}>
              <p style={{ margin: 0, color: 'var(--text-main)' }}>
                <strong>🏳️‍🌈 This is an LGBTQ+-first space.</strong> We welcome respectful allies, but queer voices are prioritised. By joining, you agree to treat all identities with respect, care, and emotional intelligence.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div
            id="register-error"
            className="error-message"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

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
              style={{ marginTop: 'var(--space-md)', width: '100%' }}
            >
              Skip for Now
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" aria-label="Registration form">
            {/* SECTION: Account Basics (Required) */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: '600',
                marginBottom: 'var(--space-md)',
                color: 'var(--pryde-purple)'
              }}>
                Account Basics
              </h3>

              <div className="form-group">
                <label htmlFor="fullName">
                  Full Name <span style={{ color: 'var(--pryde-purple)', fontWeight: 'bold' }}>*</span>
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="form-input glossy"
                  placeholder="Your full name"
                  autoComplete="name"
                  aria-required="true"
                />
                <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-xs)', display: 'block' }}>
                  This helps keep the community safe
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="username">
                  Username <span style={{ color: 'var(--pryde-purple)', fontWeight: 'bold' }}>*</span>
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="form-input glossy"
                  placeholder="@yourname"
                  autoComplete="username"
                  aria-required="true"
                  aria-invalid={usernameAvailable && !usernameAvailable.available ? 'true' : 'false'}
                  aria-describedby={formData.username.length >= 3 ? 'username-feedback' : undefined}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-xs)', display: 'block' }}>
                  This is your public handle
                </small>
                {formData.username.length >= 3 && (
                  <div
                    id="username-feedback"
                    className="username-feedback"
                    role={usernameAvailable && !usernameAvailable.available ? 'alert' : 'status'}
                    aria-live="polite"
                    style={{
                      marginTop: 'var(--space-sm)',
                      fontSize: 'var(--font-size-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-sm)'
                    }}
                  >
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
                <label htmlFor="email">
                  Email <span style={{ color: 'var(--pryde-purple)', fontWeight: 'bold' }}>*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="form-input glossy"
                  placeholder="your.email@example.com"
                  autoComplete="email"
                  aria-required="true"
                  aria-invalid={error && error.toLowerCase().includes('email') ? 'true' : 'false'}
                  aria-describedby={error && error.toLowerCase().includes('email') ? 'register-error' : undefined}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  Password <span style={{ color: 'var(--pryde-purple)', fontWeight: 'bold' }}>*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  aria-required="true"
                  aria-invalid={error && error.toLowerCase().includes('password') ? 'true' : 'false'}
                  aria-describedby={error && error.toLowerCase().includes('password') ? 'register-error' : 'password-requirements'}
                  required
                  minLength="8"
                  className="form-input glossy"
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                />
                {formData.password && (
                  <div className="password-strength" style={{ marginTop: 'var(--space-sm)' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 'var(--space-sm)'
                    }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        Password Strength:
                      </span>
                      <span style={{
                        fontSize: 'var(--font-size-sm)',
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
                      borderRadius: 'var(--border-radius-sm)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${(passwordStrength.score / 7) * 100}%`,
                        height: '100%',
                        background: passwordStrength.color,
                        transition: 'all 0.3s ease',
                        borderRadius: 'var(--border-radius-sm)'
                      }} />
                    </div>
                  </div>
                )}
                <small
                  id="password-requirements"
                  style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-sm)', display: 'block' }}
                >
                  Must contain at least one uppercase letter, one lowercase letter, and one number
                </small>
              </div>
            </div>

            {/* SECTION: Safety & Age (Required) */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
              <h3 style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: '600',
                marginBottom: 'var(--space-md)',
                color: 'var(--pryde-purple)'
              }}>
                Safety & Age Verification
              </h3>

              <div className="form-group">
                <label>Birthday <span style={{ color: 'var(--pryde-purple)', fontWeight: 'bold' }}>*</span></label>
                <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-sm)', display: 'block' }}>
                  You must be 18 or older to join Pryde
                </small>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: 'var(--space-sm)' }}>
                  <select
                    name="birthMonth"
                    value={formData.birthMonth}
                    onChange={handleChange}
                    required
                    className="form-input glossy"
                    style={{ padding: 'var(--space-sm)' }}
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
                    style={{ padding: 'var(--space-sm)' }}
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
                    style={{ padding: 'var(--space-sm)' }}
                  >
                    <option value="">Year</option>
                    {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 18 - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION: About You (Optional) */}
            {!skipOptional && (
              <div style={{
                marginBottom: 'var(--space-xl)',
                padding: 'var(--space-lg)',
                background: 'var(--soft-lavender)',
                borderRadius: 'var(--border-radius-lg)',
                border: '2px dashed var(--pryde-purple-light)'
              }}>
                <div style={{ marginBottom: 'var(--space-md)' }}>
                  <h3 style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: '600',
                    marginBottom: 'var(--space-sm)',
                    color: 'var(--pryde-purple)'
                  }}>
                    About You (Optional)
                  </h3>
                  <p style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-muted)',
                    lineHeight: 'var(--line-height-base)',
                    marginBottom: 'var(--space-sm)'
                  }}>
                    You can skip this for now and edit it later.
                  </p>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '600', color: 'var(--pryde-purple)', marginBottom: 'var(--space-sm)', display: 'block' }}>
                    🌈 How do you identify on Pryde?
                  </label>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-md)', lineHeight: 'var(--line-height-base)' }}>
                    Pryde is a calm, queer-first creative platform for LGBTQ+ introverts, deep thinkers, and supportive allies.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    <label className="checkbox-label" style={{
                      padding: 'var(--space-sm)',
                      background: formData.identity === 'LGBTQ+' ? 'var(--pryde-purple)' : 'var(--card-surface)',
                      color: formData.identity === 'LGBTQ+' ? 'white' : 'var(--text-main)',
                      border: formData.identity === 'LGBTQ+' ? '2px solid var(--pryde-purple)' : '2px solid var(--border-light)',
                      borderRadius: 'var(--border-radius-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}>
                      <input
                        type="radio"
                        name="identity"
                        value="LGBTQ+"
                        checked={formData.identity === 'LGBTQ+'}
                        onChange={handleChange}
                        style={{ marginRight: 'var(--space-sm)' }}
                      />
                      <span>I am LGBTQ+</span>
                    </label>
                    <label className="checkbox-label" style={{
                      padding: 'var(--space-sm)',
                      background: formData.identity === 'Ally' ? 'var(--pryde-purple)' : 'var(--card-surface)',
                      color: formData.identity === 'Ally' ? 'white' : 'var(--text-main)',
                      border: formData.identity === 'Ally' ? '2px solid var(--pryde-purple)' : '2px solid var(--border-light)',
                      borderRadius: 'var(--border-radius-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}>
                      <input
                        type="radio"
                        name="identity"
                        value="Ally"
                        checked={formData.identity === 'Ally'}
                        onChange={handleChange}
                        style={{ marginRight: 'var(--space-sm)' }}
                      />
                      <span>I am an ally and agree to respect queer spaces</span>
                    </label>
                  </div>
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
                    placeholder="How you'd like to be called (optional)"
                    autoComplete="off"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pronouns">Pronouns</label>
                  <input
                    type="text"
                    id="pronouns"
                    name="pronouns"
                    value={formData.pronouns}
                    onChange={handleChange}
                    className="form-input glossy"
                    placeholder="e.g., they/them, she/her, he/him (optional)"
                    autoComplete="off"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bio">Bio</label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    className="form-input glossy"
                    placeholder="Tell us a bit about yourself (optional)"
                    rows="3"
                    maxLength="500"
                    style={{ resize: 'vertical', minHeight: '80px' }}
                  />
                  {formData.bio && (
                    <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-xs)', display: 'block' }}>
                      {formData.bio.length}/500 characters
                    </small>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSkipOptional(true)}
                  className="btn-secondary"
                  style={{
                    width: '100%',
                    marginTop: 'var(--space-md)',
                    background: 'transparent',
                    border: '2px solid var(--pryde-purple)',
                    color: 'var(--pryde-purple)'
                  }}
                >
                  Skip for Now
                </button>
              </div>
            )}

            {skipOptional && (
              <div style={{
                marginBottom: 'var(--space-xl)',
                padding: 'var(--space-md)',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--border-radius-md)',
                textAlign: 'center'
              }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                  ✓ Optional profile sections skipped
                </p>
                <button
                  type="button"
                  onClick={() => setSkipOptional(false)}
                  className="btn-link"
                  style={{ color: 'var(--pryde-purple)', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Go back and fill them out
                </button>
              </div>
            )}

            {/* Terms & CAPTCHA */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
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
                    I agree to the <a href="/terms" target="_blank" className="auth-link">Terms of Service</a> and <a href="/privacy" target="_blank" className="auth-link">Privacy Policy</a> <span style={{ color: 'var(--pryde-purple)', fontWeight: 'bold' }}>*</span>
                  </span>
                </label>
              </div>

              {/* hCaptcha */}
              <div className="form-group" style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: 'var(--space-lg)',
                marginBottom: 'var(--space-md)'
              }}>
                <HCaptcha
                  ref={captchaRef}
                  sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001'}
                  onVerify={onCaptchaVerify}
                  onExpire={onCaptchaExpire}
                  theme={document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'}
                />
              </div>
            </div>

            {/* Calming microcopy before submit */}
            <p style={{
              textAlign: 'center',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-md)',
              lineHeight: 'var(--line-height-base)'
            }}>
              You can update your profile anytime.
            </p>

            <button
              type="submit"
              disabled={loading || !formData.fullName || !formData.username || !formData.email || !formData.password || !formData.birthMonth || !formData.birthDay || !formData.birthYear || !formData.termsAccepted || !captchaToken}
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
