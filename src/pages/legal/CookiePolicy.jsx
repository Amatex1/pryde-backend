import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import './Legal.css';

function CookiePolicy() {
  // Apply user's dark mode preference
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  return (
    <div className="legal-page">
      <div className="legal-header">
        <h1>🌈 Pryde Social — Cookie Policy</h1>
        <p className="legal-subtitle">Last Updated: November 26, 2025</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>1. What Cookies We Use</h2>
          <ul>
            <li>Session cookies (authentication)</li>
            <li>Security cookies</li>
            <li>Basic preferences</li>
          </ul>
          <p>
            <strong>We do not use tracking or advertising cookies.</strong>
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Why We Use Cookies</h2>
          <ul>
            <li>Keep you logged in</li>
            <li>Protect accounts</li>
            <li>Improve site stability</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. Managing Cookies</h2>
          <p>
            You can disable cookies in your browser, but some features may not work.
          </p>
        </section>

        <div className="legal-footer-note">
          <p className="last-updated">
            Last Updated: November 26, 2025
          </p>
        </div>
      </div>

      <div className="legal-nav-footer">
        <Link to="/" className="back-link">← Back to Home</Link>
      </div>
    </div>
  );
}

export default CookiePolicy;

