import { Link } from 'react-router-dom';
import './Legal.css';

function Privacy() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <h1>🌈 Pryde Social — Privacy Policy</h1>
        <p className="legal-subtitle">Last Updated: January 1, 2025</p>
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
          <h2>5. Messages</h2>
          <p>
            Messages are private between users but may be reviewed only:
          </p>
          <ul>
            <li>When reported</li>
            <li>For safety or legal compliance</li>
            <li>During moderation of harmful behavior</li>
          </ul>
          <p>
            <strong>We do not read private messages unnecessarily.</strong>
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Data Storage</h2>
          <p>
            Data is stored securely using encryption where appropriate. Some data may be stored in backups for security and recovery purposes.
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
            Last Updated: January 1, 2025
          </p>
        </div>
      </div>

      <div className="legal-nav-footer">
        <Link to="/" className="back-link">← Back to Home</Link>
        <div className="legal-links">
          <Link to="/terms">Terms of Service</Link>
          <Link to="/community-guidelines">Community Guidelines</Link>
          <Link to="/cookie-policy">Cookie Policy</Link>
          <Link to="/faq">FAQ</Link>
        </div>
      </div>
    </div>
  );
}

export default Privacy;
