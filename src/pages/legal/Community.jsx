import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import './Legal.css';

function Community() {
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
        <h1>🌈 Pryde Social — Community Guidelines</h1>
        <p className="legal-subtitle">Last Updated: 10.12.2025</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <p>
            Pryde Social is an 18+ LGBTQ+ community platform. These guidelines help keep the space safe, respectful, and welcoming.
          </p>
        </section>

        <section className="legal-section">
          <h2>1. Respect LGBTQ+ Identities</h2>
          <ul>
            <li>Use correct pronouns</li>
            <li>Respect gender identities and sexual orientations</li>
            <li>No misgendering or deadnaming</li>
            <li>No conversion therapy promotion</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>2. Be Kind & Respectful</h2>
          <ul>
            <li>Treat others with empathy</li>
            <li>Disagree respectfully</li>
            <li>No harassment, bullying, or threats</li>
            <li>No doxxing (sharing private information)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. Adult Content Rules (18+ Only)</h2>
          <p>
            <strong>Allowed:</strong>
          </p>
          <ul>
            <li>Artistic nudity</li>
            <li>Educational sexual health content</li>
            <li>LGBTQ+ expression</li>
          </ul>
          <p>
            <strong>NOT Allowed:</strong>
          </p>
          <ul>
            <li>Explicit sexual content</li>
            <li>Pornography</li>
            <li>Non-consensual content</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Hate Speech</h2>
          <p>
            <strong>Zero tolerance for:</strong>
          </p>
          <ul>
            <li>Slurs or derogatory language</li>
            <li>Racism, sexism, homophobia, transphobia</li>
            <li>Attacks based on identity</li>
            <li>Hate symbols or imagery</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>5. GIF Content & Usage</h2>
          <p>
            <strong>When using GIFs (powered by Tenor):</strong>
          </p>
          <ul>
            <li>Ensure GIFs are appropriate and comply with these guidelines</li>
            <li>Do not use GIFs containing hate speech, violence, or explicit sexual content</li>
            <li>Do not spam GIFs in posts, comments, or Lounge</li>
            <li>Respect copyright and intellectual property in GIF content</li>
          </ul>
          <p>
            You are responsible for the GIFs you select and share.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Lounge (Global Chat) Rules</h2>
          <p>
            <strong>The Lounge is a public space for all users. Please:</strong>
          </p>
          <ul>
            <li>Be respectful and welcoming to all participants</li>
            <li>Do not spam messages or flood the chat</li>
            <li>Do not share explicit sexual content in Lounge</li>
            <li>Do not harass, bully, or target other users</li>
            <li>Do not share personal information (yours or others')</li>
            <li>Keep conversations appropriate for a public space</li>
          </ul>
          <p>
            Violations may result in temporary or permanent Lounge bans.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Reaction Etiquette</h2>
          <p>
            <strong>When using reactions:</strong>
          </p>
          <ul>
            <li>Do not spam reactions on posts or comments</li>
            <li>Do not use reactions to harass or mock users</li>
            <li>Reactions should be used to express genuine engagement</li>
          </ul>
          <p>
            Abuse of the reaction system may result in restrictions or account suspension.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Illegal Content</h2>
          <p>
            <strong>Absolutely prohibited:</strong>
          </p>
          <ul>
            <li>CSAM (child sexual abuse material) — zero tolerance</li>
            <li>Revenge porn or non-consensual content</li>
            <li>Illegal drug sales</li>
            <li>Fraud or scams</li>
            <li>Threats or violence</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>9. Safety</h2>
          <p>
            <strong>If you feel unsafe:</strong>
          </p>
          <ul>
            <li>Block the user</li>
            <li>Report the content</li>
            <li>Contact us at <span className="contact-email">prydeapp-team@outlook.com</span></li>
          </ul>
          <p>
            See <Link to="/safety" className="legal-link">Safety Center</Link> for more information.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Consequences</h2>
          <p>
            Violations may result in:
          </p>
          <ul>
            <li>Content removal</li>
            <li>Warnings</li>
            <li>Temporary suspension</li>
            <li>Permanent ban</li>
            <li>Lounge access restrictions</li>
            <li>Reaction privileges removed</li>
          </ul>
          <p>
            Severe violations (CSAM, threats, hate speech) result in immediate bans.
          </p>
        </section>

        <section className="legal-section">
          <h2>11. Contact</h2>
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

export default Community;
