import { Link } from 'react-router-dom';
import './Legal.css';

function Terms() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <h1>🌈 Pryde Social — Terms of Service</h1>
        <p className="legal-subtitle">Last Updated: January 1, 2025</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <p>
            Welcome to Pryde Social ("Pryde", "we", "our", "the platform"). By accessing or using Pryde Social, you agree to these Terms of Service.
          </p>
          <p>
            <strong>If you do not agree, you must not use the platform.</strong>
          </p>
        </section>

        <section className="legal-section">
          <h2>1. Eligibility</h2>
          <p>
            <strong>Pryde Social is strictly 18+ only.</strong>
          </p>
          <p>
            By using the platform, you confirm you are 18 years or older.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Description of Service</h2>
          <p>
            Pryde Social is a hobby-operated LGBTQ+ community platform where users can create profiles, post content, send messages, and interact with other adults.
          </p>
          <p>
            <strong>We do not guarantee:</strong>
          </p>
          <ul>
            <li>Uninterrupted access</li>
            <li>Error-free operation</li>
            <li>Permanent data storage</li>
          </ul>
          <p>
            This platform is operated privately by an individual, not a company.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. User Conduct</h2>
          <p>
            <strong>You agree not to:</strong>
          </p>
          <ul>
            <li>Harass, threaten, or abuse other users</li>
            <li>Post hate speech, discrimination, or slurs</li>
            <li>Post or share illegal content</li>
            <li>Share CSAM (child sexual abuse material) — zero tolerance</li>
            <li>Impersonate others</li>
            <li>Spam, scam, or mislead users</li>
            <li>Post revenge porn or non-consensual content</li>
            <li>Use Pryde to stalk, monitor, or harm others</li>
          </ul>
          <p>
            Violations may result in warnings, suspensions, or permanent bans.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. 18+ Content</h2>
          <p>
            <strong>Adult content is allowed only if:</strong>
          </p>
          <ul>
            <li>All individuals depicted are adults</li>
            <li>Content is consensual</li>
            <li>It complies with local laws</li>
            <li>It does not include exploitation or illegal behavior</li>
          </ul>
          <p>
            We reserve the right to remove content that is unsafe or harmful.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Account Responsibilities</h2>
          <p>
            <strong>You are responsible for:</strong>
          </p>
          <ul>
            <li>Maintaining account security</li>
            <li>Not sharing your password</li>
            <li>Reviewing your privacy and safety settings</li>
          </ul>
          <p>
            You agree that anything posted from your account is your responsibility.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Content Ownership</h2>
          <p>
            You retain copyright to your content. However, by posting on Pryde Social, you grant us a non-exclusive license to display and distribute your content within the platform.
          </p>
          <p>
            <strong>We do not claim ownership of user content.</strong>
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Removal of Content</h2>
          <p>
            <strong>We may remove content that:</strong>
          </p>
          <ul>
            <li>Violates policies</li>
            <li>Is harmful or unsafe</li>
            <li>Is reported and verified</li>
            <li>Involves copyright infringement</li>
            <li>Harasses or targets individuals</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>8. Termination</h2>
          <p>
            We may suspend or terminate accounts that violate these Terms. You may delete your account at any time.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Disclaimers</h2>
          <p>
            Pryde Social is provided "as is" with no warranties.
          </p>
          <p>
            <strong>We are:</strong>
          </p>
          <ul>
            <li>Not responsible for user actions</li>
            <li>Not liable for harm caused by user content</li>
            <li>Not a crisis or emergency service</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>10. Limitation of Liability</h2>
          <p>
            To the fullest extent allowed by law, Pryde Social (its operator) is not liable for:
          </p>
          <ul>
            <li>Loss of data</li>
            <li>Harassment or interactions between users</li>
            <li>Damages arising from use of the platform</li>
            <li>Misuse of content by others</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>11. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. We encourage you to review them periodically.
          </p>
        </section>

        <section className="legal-section">
          <h2>12. Contact</h2>
          <p>
            For questions or concerns:
          </p>
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
      </div>
    </div>
  );
}

export default Terms;
