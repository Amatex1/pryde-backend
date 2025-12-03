import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    termsAccepted: false,
    isAlly: false // PHASE 6: Ally system
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasskeySetup, setShowPasskeySetup] = useState(false);
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

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate birthday is provided
    if (!formData.birthday) {
      setError('Please enter your full birthday');
      return;
    }

    // Calculate age from birthday
    const birthDate = new Date(formData.birthday);
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

      const response = await api.post('/auth/signup', formData);
      
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
            />
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
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
              Must contain at least one uppercase letter, one lowercase letter, and one number
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="birthday">Birthday <span style={{ color: 'var(--pryde-purple)', fontWeight: 'bold' }}>*</span></label>
            <input
              type="date"
              id="birthday"
              name="birthday"
              value={formData.birthday}
              onChange={handleChange}
              required
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
              className="form-input glossy"
            />
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
              <label className="checkbox-label" style={{ padding: '0.75rem', background: formData.isAlly === false ? 'var(--pryde-purple)' : 'white', color: formData.isAlly === false ? 'white' : 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.3s ease' }}>
                <input
                  type="radio"
                  name="identityType"
                  checked={formData.isAlly === false}
                  onChange={() => setFormData({ ...formData, isAlly: false })}
                  style={{ marginRight: '0.5rem' }}
                />
                <span>I am LGBTQ+</span>
              </label>
              <label className="checkbox-label" style={{ padding: '0.75rem', background: formData.isAlly === true ? 'var(--pryde-purple)' : 'white', color: formData.isAlly === true ? 'white' : 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.3s ease' }}>
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

          <button type="submit" disabled={loading || !formData.birthday || !formData.termsAccepted} className="btn-primary glossy-gold">
            {loading ? 'Join Pryde' : 'Create Account'}
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
