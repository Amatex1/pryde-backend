import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { setAuthToken, setCurrentUser } from '../utils/auth';
import './Auth.css';

function Register({ setIsAuth }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    displayName: '',
    birthday: '',
    termsAccepted: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
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
      navigate('/feed');
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
          <p className="auth-subtitle">Create your account and start connecting!</p>
        </div>

        {error && <div className="error-message">{error}</div>}

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
              minLength="6"
              className="form-input glossy"
              placeholder="Create a password (min 6 characters)"
            />
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
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

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
      </div>
    </div>
  );
}

export default Register;
