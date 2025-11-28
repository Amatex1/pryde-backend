import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import './Legal.css';

function Privacy() {
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
        <h1>🌈 Pryde Social — Privacy Policy</h1>
        <p className="legal-subtitle">Last Updated: December 28, 2024</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>1. Overview</h2>
          <p>
            Your privacy matters to us. Pryde Social does not sell user data and keeps your information confidential unless required by law.
          </p>
          <p>
            <strong>Pryde Social is a hobby-run platform operated in Australia.</strong>
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Information We Collect</h2>

          <h3>A. Information You Provide</h3>
          <ul>
            <li>Email</li>
            <li>Password (encrypted)</li>
            <li>Profile details (name, pronouns, gender, orientation, bio, etc.)</li>
            <li>Location (city/town only)</li>
            <li>Photos you upload</li>
            <li>Posts, comments, messages</li>
          </ul>

          <h3>B. Automatically Collected Information</h3>
          <ul>
            <li>IP address</li>
            <li>Device information</li>
            <li>Browser type</li>
            <li>Usage data (timestamps, interactions)</li>
          </ul>

          <h3>C. Sensitive Information (Optional)</h3>
          <p>You may choose to share:</p>
          <ul>
            <li>Gender identity</li>
            <li>Sexual orientation</li>
            <li>Relationship status</li>
          </ul>
          <p>
            <strong>You control what is visible on your profile.</strong>
          </p>
        </section>

        <section className="legal-section">
          <h2>3. How We Use Your Information</h2>
          <p>
            <strong>To:</strong>
          </p>
          <ul>
            <li>Operate the platform</li>
            <li>Protect community safety</li>
            <li>Display content</li>
            <li>Moderate harmful behavior</li>
            <li>Send necessary notifications</li>
            <li>Respond to reports and legal inquiries</li>
          </ul>
          <p>
            <strong>We do not use your data for advertising.</strong>
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Data Sharing</h2>
          <p>
            <strong>We do not sell or rent your data.</strong>
          </p>
          <p>
            We may share data only:
          </p>
          <ul>
            <li>To comply with legal obligations</li>
            <li>To respond to DMCA requests</li>
            <li>To investigate severe platform abuse</li>
            <li>With service providers (hosting/database)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>5. Messages & Privacy</h2>
          <p>
            <strong>Private messages may be accessed only when reported for safety or legal reasons.</strong>
          </p>
          <p>
            Messages are private between users but may be reviewed only:
          </p>
          <ul>
            <li>When reported by a user</li>
            <li>For safety investigations or legal compliance</li>
            <li>During moderation of harmful behavior</li>
            <li>In response to law enforcement requests</li>
          </ul>
          <p>
            <strong>We do not proactively monitor or read private messages.</strong> Your conversations remain private unless a report or legal obligation requires review.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Data Storage</h2>
          <p>
            Data is stored securely using encryption where appropriate. Some data may be stored in backups for security and recovery purposes.
          </p>
        </section>

        <section className="legal-section">
          <h2>6A. Security Measures</h2>
          <p>
            <strong>We implement industry-standard security measures to protect your data:</strong>
          </p>
          <ul>
            <li><strong>Encryption:</strong> All data transmitted between your device and our servers is encrypted using HTTPS/TLS</li>
            <li><strong>Password Security:</strong> Passwords are hashed using bcrypt and never stored in plain text</li>
            <li><strong>Account Protection:</strong> Automatic account lockout after 5 failed login attempts (15-minute lock)</li>
            <li><strong>Two-Factor Authentication:</strong> Optional 2FA available for enhanced account security</li>
            <li><strong>Session Management:</strong> Secure session tracking with device and IP monitoring</li>
            <li><strong>Attack Prevention:</strong> Protection against XSS, CSRF, SQL injection, and other common attacks</li>
            <li><strong>Security Monitoring:</strong> Automated detection of suspicious login attempts and security threats</li>
            <li><strong>Rate Limiting:</strong> Protection against brute-force attacks and spam</li>
          </ul>
          <p>
            For detailed information about our security practices, see our <Link to="/security" className="legal-link">Security</Link> page.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. User Rights</h2>
          <p>
            <strong>You may:</strong>
          </p>
          <ul>
            <li>Access your data</li>
            <li>Correct your data</li>
            <li>Delete your account</li>
            <li>Request profile removal</li>
            <li>Request data deletion</li>
          </ul>
          <div className="contact-info">
            <p>
              <strong>Contact:</strong> <span className="contact-email">prydeapp-team@outlook.com</span>
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>8. Cookies</h2>
          <p>
            <strong>Used only for:</strong>
          </p>
          <ul>
            <li>Login sessions</li>
            <li>Security</li>
            <li>Basic site functionality</li>
          </ul>
          <p>
            See <Link to="/cookie-policy" className="legal-link">Cookie Policy</Link> for details.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. International Users</h2>
          <p>
            Your data may be processed outside your region depending on hosting providers.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Contact</h2>
          <div className="contact-info">
            <p><strong>📧</strong> <span className="contact-email">prydeapp-team@outlook.com</span></p>
          </div>
        </section>

        <div className="legal-footer-note">
          <p className="last-updated">
            Last Updated: December 28, 2024
          </p>
        </div>
      </div>

      <div className="legal-nav-footer">
        <Link to="/" className="back-link">← Back to Home</Link>
      </div>
    </div>
  );
}

export default Privacy;
