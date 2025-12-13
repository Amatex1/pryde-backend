import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import './Legal.css';

function Terms() {
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
        <h1>🌈 Pryde Social — Terms of Service</h1>
        <p className="legal-subtitle">Last Updated: 10.12.2025</p>
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
            By using the platform, you confirm you are 18 years or older. Age verification is required at signup.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Description of Service</h2>
          <p>
            Pryde Social is a queer-centred social platform built by an LGBTQ+ creator for LGBTQ+ people. It's a space designed for safety, privacy, and genuine connection — not algorithms, virality, or engagement metrics.
          </p>
          <p>
            Respectful allies are welcome, but queer voices are prioritised. LGBTQ+ identities, rights, and existence are not up for debate.
          </p>
          <p>
            <strong>Platform features include:</strong>
          </p>
          <ul>
            <li>Posts with text, images, videos, and GIFs</li>
            <li>Comments and reactions on posts</li>
            <li>Direct messages (DMs) between users</li>
            <li>Lounge (global chat room)</li>
            <li>Journals, longform posts, and photo essays</li>
            <li>Community tags and discovery</li>
            <li>Events system</li>
            <li>Bookmarks and sharing</li>
            <li>Privacy controls and Quiet Mode</li>
            <li>Security features (2FA, passkeys, email verification)</li>
          </ul>
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
            <strong>Pryde Social is a queer-centred space. You agree to:</strong>
          </p>
          <ul>
            <li>Respect all LGBTQ+ identities, pronouns, and lived experiences</li>
            <li>Treat others with empathy, care, and emotional intelligence</li>
            <li>Understand that LGBTQ+ identities, rights, and existence are not up for debate</li>
            <li>Engage in good faith and avoid bad-faith arguments or "devil's advocate" tactics</li>
          </ul>
          <p>
            <strong>You agree not to:</strong>
          </p>
          <ul>
            <li>Harass, threaten, bully, or abuse other users</li>
            <li>Post hate speech, discrimination, slurs, or attacks based on identity</li>
            <li>Invalidate, question, or debate someone's gender, sexuality, or lived experience</li>
            <li>Fetishise LGBTQ+ people or treat identities as a kink</li>
            <li>Misgender, deadname, or disrespect pronouns</li>
            <li>Post or share illegal content</li>
            <li>Share CSAM (child sexual abuse material) — zero tolerance, immediate ban</li>
            <li>Impersonate others</li>
            <li>Spam, scam, or mislead users</li>
            <li>Post revenge porn or non-consensual content</li>
            <li>Use Pryde to stalk, monitor, or harm others</li>
          </ul>
          <p>
            Violations may result in content removal, warnings, temporary restrictions, or permanent bans. Severe violations result in immediate bans.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. 18+ Content & Media Responsibility</h2>
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
            <strong>Users are responsible for ensuring that all photos, videos, GIFs, and other media uploaded to Pryde Social involve adults and are consensual.</strong>
          </p>
          <p>
            <strong>GIF Content:</strong> When using GIFs from Tenor (powered by Google), you are responsible for ensuring the GIF content is appropriate and complies with these Terms. We are not responsible for third-party GIF content.
          </p>
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
          <h2>7. Removal of Content & Private Messages</h2>
          <p>
            <strong>We may remove content that:</strong>
          </p>
          <ul>
            <li>Violates policies</li>
            <li>Is harmful or unsafe</li>
            <li>Is reported and verified</li>
            <li>Involves copyright infringement</li>
            <li>Harasses or targets individuals</li>
            <li>Is flagged by automated content moderation (spam detection, toxicity scoring)</li>
          </ul>
          <p>
            <strong>Automated Content Moderation:</strong> We use automated systems to detect spam, toxic content, and policy violations. Content flagged by these systems may be automatically hidden or removed.
          </p>
          <p>
            <strong>Private messages are not monitored unless reported.</strong> We respect your privacy and do not proactively monitor private conversations. However, reported messages may be reviewed for safety and policy enforcement.
          </p>
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
          <h2>11. Third-Party Services</h2>
          <p>
            <strong>Pryde Social uses the following third-party services:</strong>
          </p>
          <ul>
            <li><strong>hCaptcha (Intuition Machines, Inc.):</strong> Bot protection during registration. See hCaptcha's <a href="https://www.hcaptcha.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="https://www.hcaptcha.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</li>
            <li><strong>Tenor (Google):</strong> GIF search and display. When you use GIFs, data is shared with Tenor. See Tenor's <a href="https://tenor.com/legal-privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</li>
          </ul>
          <p>
            By using these features, you agree to the respective third-party terms and privacy policies.
          </p>
        </section>

        <section className="legal-section">
          <h2>12. Security Features</h2>
          <p>
            <strong>We provide the following security features:</strong>
          </p>
          <ul>
            <li><strong>Email Verification:</strong> Required for account activation</li>
            <li><strong>Two-Factor Authentication (2FA):</strong> Optional enhanced security</li>
            <li><strong>Passkeys/WebAuthn:</strong> Optional passwordless authentication</li>
            <li><strong>Account Lockout:</strong> Automatic lockout after 5 failed login attempts (15-minute lock)</li>
            <li><strong>Rate Limiting:</strong> Protection against brute-force attacks and spam</li>
            <li><strong>Session Management:</strong> Secure session tracking with device monitoring</li>
          </ul>
          <p>
            You are responsible for enabling and maintaining these security features on your account.
          </p>
        </section>

        <section className="legal-section">
          <h2>13. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. We encourage you to review them periodically.
          </p>
        </section>

        <section className="legal-section">
          <h2>14. Contact</h2>
          <p>
            For questions or concerns:
          </p>
          <div className="contact-info">
            <p><strong>📧</strong> <span className="contact-email">prydeapp-team@outlook.com</span></p>
          </div>
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

export default Terms;
