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
        <Link to="/" className="legal-home-button">
          🏠 Home
        </Link>
        <h1>🌈 Pryde Social — Cookie Policy</h1>
        <p className="legal-subtitle">Last Updated: 10.12.2025</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <p className="legal-highlight">
            <strong>🍪 We only use essential cookies for security and functionality. Pryde Social does not use tracking, analytics, or advertising cookies. No consent is required for essential cookies under GDPR.</strong>
          </p>
        </section>

        <section className="legal-section">
          <h2>1. What Cookies We Use</h2>
          <ul>
            <li><strong>Session cookies</strong> - Keep you logged in (authentication)</li>
            <li><strong>Security cookies</strong> - CSRF protection tokens (XSRF-TOKEN)</li>
            <li><strong>Preference cookies</strong> - Remember your settings (dark mode, etc.)</li>
          </ul>
          <p>
            <strong>We do not use tracking or advertising cookies.</strong>
          </p>
          <p>
            <strong>Cookie Details:</strong>
          </p>
          <ul>
            <li><strong>Authentication Token:</strong> Stores your login session (HttpOnly, Secure, SameSite)</li>
            <li><strong>XSRF-TOKEN:</strong> Protects against cross-site request forgery attacks</li>
            <li><strong>Dark Mode Preference:</strong> Remembers your theme choice</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>2. Why We Use Cookies</h2>
          <ul>
            <li><strong>Keep you logged in</strong> - Maintain your session across pages</li>
            <li><strong>Protect your account</strong> - Prevent unauthorized access and CSRF attacks</li>
            <li><strong>Remember preferences</strong> - Save your settings like dark mode</li>
            <li><strong>Improve site stability</strong> - Ensure smooth functionality</li>
          </ul>
          <p>
            All cookies are essential for the platform to function properly and securely.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Managing Cookies</h2>
          <p>
            You can disable cookies in your browser settings, but please note that doing so will prevent you from logging in and using Pryde Social, as all our cookies are essential for the platform to function.
          </p>
          <p>
            <strong>Browser Cookie Settings:</strong>
          </p>
          <ul>
            <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
            <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
            <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</li>
            <li><strong>Edge:</strong> Settings → Cookies and site permissions → Manage and delete cookies</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. GDPR Compliance</h2>
          <p>
            Under the General Data Protection Regulation (GDPR), websites are required to obtain consent for non-essential cookies. However, <strong>essential cookies that are strictly necessary for the website to function do not require consent</strong>.
          </p>
          <p>
            All cookies used by Pryde Social fall into the "strictly necessary" category:
          </p>
          <ul>
            <li><strong>Authentication:</strong> Required to keep you logged in</li>
            <li><strong>Security:</strong> Required to protect against attacks (CSRF)</li>
            <li><strong>Preferences:</strong> Required to remember your settings (dark mode)</li>
          </ul>
          <p>
            Therefore, <strong>no cookie consent banner is legally required</strong> for Pryde Social under GDPR Article 6(1)(f) (legitimate interests) and ePrivacy Directive Article 5(3).
          </p>
        </section>

        <div className="legal-footer-note">
          <p className="last-updated">
            Last Updated: 10.12.2025
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

