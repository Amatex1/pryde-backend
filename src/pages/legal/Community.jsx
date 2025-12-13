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
          <div style={{
            background: 'var(--soft-lavender)',
            border: '2px solid var(--pryde-purple)',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <h2 style={{ color: 'var(--pryde-purple)', marginTop: 0 }}>🏳️‍🌈 This is a Queer-Centred Space</h2>
            <p>
              <strong>Pryde Social is built by and for LGBTQ+ people.</strong> This is a space where queer voices are prioritised, lived experiences are honoured, and our identities, rights, and existence are not up for debate.
            </p>
            <p>
              Respectful allies are welcome and valued, but this community centres queer people first. We ask that everyone approach this space with emotional intelligence, empathy, and a commitment to learning.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>1. Our Core Values</h2>
          <p>
            <strong>Pryde Social is grounded in:</strong>
          </p>
          <ul>
            <li><strong>Safety:</strong> Protecting our community from harm, harassment, and hate</li>
            <li><strong>Respect:</strong> Honouring each person's identity, pronouns, and lived experience</li>
            <li><strong>Authenticity:</strong> Creating space for genuine self-expression and connection</li>
            <li><strong>Care:</strong> Supporting one another with kindness and emotional intelligence</li>
            <li><strong>Inclusion:</strong> Welcoming all LGBTQ+ identities and respectful allies</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>2. Respect LGBTQ+ Identities</h2>
          <p>
            <strong>LGBTQ+ identities, rights, and existence are not up for debate.</strong>
          </p>
          <ul>
            <li>Always use people's correct pronouns and chosen names</li>
            <li>Respect all gender identities, sexual orientations, and relationship structures</li>
            <li>No misgendering, deadnaming, or identity invalidation</li>
            <li>No "devil's advocate" arguments about LGBTQ+ rights or existence</li>
            <li>No promotion of conversion therapy or similar harmful practices</li>
            <li>No fetishisation of LGBTQ+ people or relationships</li>
          </ul>
          <p>
            <strong>This is non-negotiable.</strong> Queer people should not have to justify their existence or educate others in bad faith.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Be Kind & Respectful</h2>
          <p>
            <strong>We protect this space through care, not punishment.</strong>
          </p>
          <ul>
            <li>Treat others with empathy and emotional intelligence</li>
            <li>Listen to understand, especially when someone shares their lived experience</li>
            <li>Disagree respectfully — focus on ideas, not personal attacks</li>
            <li>Respect boundaries when someone says "no" or asks you to stop</li>
            <li>No harassment, bullying, threats, or targeted attacks</li>
            <li>No doxxing (sharing private information without consent)</li>
            <li>No sea-lioning or bad-faith debate tactics</li>
          </ul>
          <p>
            If a conversation becomes unproductive or harmful, disengage and report if necessary.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Adult Content Rules (18+ Only)</h2>
          <p>
            <strong>Allowed:</strong>
          </p>
          <ul>
            <li>Artistic nudity and creative expression</li>
            <li>Educational sexual health content</li>
            <li>LGBTQ+ expression and celebration</li>
            <li>Body-positive content</li>
          </ul>
          <p>
            <strong>Not Allowed:</strong>
          </p>
          <ul>
            <li>Explicit sexual content or pornography</li>
            <li>Non-consensual content of any kind</li>
            <li>Content involving minors</li>
          </ul>
          <p>
            <strong>Important:</strong> You are responsible for ensuring all media you upload involves consenting adults. See our <Link to="/terms" className="legal-link">Terms of Service</Link> for more details.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. What We Don't Tolerate</h2>
          <p>
            <strong>We have zero tolerance for:</strong>
          </p>
          <ul>
            <li><strong>Hate speech:</strong> Slurs, derogatory language, or attacks based on identity (race, gender, sexuality, disability, religion, etc.)</li>
            <li><strong>Harassment:</strong> Targeted abuse, bullying, stalking, or intimidation</li>
            <li><strong>Bad-faith debate:</strong> Arguing against LGBTQ+ rights, existence, or validity</li>
            <li><strong>Identity invalidation:</strong> Denying or questioning someone's gender, sexuality, or lived experience</li>
            <li><strong>Fetishisation:</strong> Objectifying LGBTQ+ people or treating identities as a kink</li>
            <li><strong>Hate symbols or imagery:</strong> Nazi symbols, Confederate flags, or similar hateful iconography</li>
          </ul>
          <p>
            These behaviours cause real harm. We remove them to protect our community.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. GIF Content & Usage</h2>
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
          <h2>7. Lounge (Global Chat) Rules</h2>
          <p>
            <strong>The Lounge is a public space for connection and conversation.</strong>
          </p>
          <ul>
            <li>Be welcoming and kind to all participants</li>
            <li>Respect the same community standards that apply everywhere on Pryde</li>
            <li>Do not spam messages or flood the chat</li>
            <li>Do not share explicit sexual content in Lounge</li>
            <li>Do not harass, bully, or target other users</li>
            <li>Do not share personal information (yours or others')</li>
            <li>Keep conversations appropriate for a shared public space</li>
          </ul>
          <p>
            If the Lounge feels unsafe, we may temporarily restrict access while we address the issue.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Reaction Etiquette</h2>
          <p>
            <strong>When using reactions:</strong>
          </p>
          <ul>
            <li>Use reactions to express genuine engagement and support</li>
            <li>Do not spam reactions on posts or comments</li>
            <li>Do not use reactions to harass, mock, or belittle users</li>
          </ul>
          <p>
            Misuse of reactions may result in temporary restrictions.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Illegal Content</h2>
          <p>
            <strong>Absolutely prohibited:</strong>
          </p>
          <ul>
            <li>CSAM (child sexual abuse material) — zero tolerance, immediate ban</li>
            <li>Revenge porn or non-consensual intimate content</li>
            <li>Illegal drug sales or trafficking</li>
            <li>Fraud, scams, or phishing</li>
            <li>Credible threats or incitement to violence</li>
          </ul>
          <p>
            We report severe violations to law enforcement when necessary.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. If You Feel Unsafe</h2>
          <p>
            <strong>Your safety matters. Here's what you can do:</strong>
          </p>
          <ul>
            <li><strong>Block the user:</strong> Go to their profile → three-dot menu → Block User</li>
            <li><strong>Report the content:</strong> Use the report button on posts, comments, or messages</li>
            <li><strong>Reach out:</strong> Contact us at <span className="contact-email">prydeapp-team@outlook.com</span></li>
            <li><strong>Use privacy tools:</strong> Adjust your privacy settings, enable Quiet Mode, or make your account private</li>
          </ul>
          <p>
            See our <Link to="/safety" className="legal-link">Safety Center</Link> for more resources and support.
          </p>
        </section>

        <section className="legal-section">
          <h2>11. How We Respond to Violations</h2>
          <p>
            <strong>We approach moderation as care and protection, not punishment.</strong>
          </p>
          <p>
            Depending on the severity and context, we may:
          </p>
          <ul>
            <li>Remove harmful content</li>
            <li>Issue a private warning with guidance</li>
            <li>Temporarily restrict access to certain features (Lounge, reactions, messaging)</li>
            <li>Temporarily suspend the account</li>
            <li>Permanently ban the account</li>
          </ul>
          <p>
            <strong>Severe violations</strong> (CSAM, credible threats, hate speech, targeted harassment) result in immediate permanent bans.
          </p>
          <p>
            Our goal is to protect the community while giving people room to learn and grow.
          </p>
        </section>

        <section className="legal-section">
          <h2>12. Contact Us</h2>
          <p>
            If you have questions about these guidelines or need support:
          </p>
          <div className="contact-info">
            <p><strong>📧 Email:</strong> <span className="contact-email">prydeapp-team@outlook.com</span></p>
          </div>
          <p>
            We're here to help create a safer, kinder space for everyone.
          </p>
        </section>

        <div className="legal-footer-note">
          <p>
            <strong>Thank you for being part of Pryde Social.</strong> Together, we're building a community where LGBTQ+ people can connect, create, and thrive.
          </p>
          <p className="last-updated">
            Last Updated: 13.12.2025
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
