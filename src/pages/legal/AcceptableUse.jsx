import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import './Legal.css';

function AcceptableUse() {
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
        <h1>🌈 Pryde Social — Acceptable Use Policy</h1>
        <p className="legal-subtitle">Last Updated: November 26, 2025</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <p>
            This policy explains what is and isn't allowed on Pryde Social.
          </p>
        </section>

        <section className="legal-section">
          <h2>1. Prohibited Activities</h2>
          <ul>
            <li>Harassment or hate speech</li>
            <li>Impersonation</li>
            <li>Spam or scams</li>
            <li>Threats or intimidation</li>
            <li>Posting illegal content</li>
            <li>Sharing private information</li>
            <li>Distributing malware or phishing links</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>2. Network & Technical Misuse</h2>
          <p>
            <strong>You may NOT:</strong>
          </p>
          <ul>
            <li>Attempt to hack the platform</li>
            <li>Scrape large amounts of data</li>
            <li>Attack our servers</li>
            <li>Attempt unauthorized access</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. Misleading Behavior</h2>
          <ul>
            <li>Fake accounts</li>
            <li>Catfishing</li>
            <li>Fraudulent fundraising</li>
            <li>Deceptive relationships</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Violating These Rules</h2>
          <p>
            May result in warnings, suspensions, or bans.
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

export default AcceptableUse;

