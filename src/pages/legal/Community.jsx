import { Link } from 'react-router-dom';
import './Legal.css';

function Community() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <h1>🌈 Pryde Social — Community Guidelines</h1>
        <p className="legal-subtitle">Last Updated: January 1, 2025</p>
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
          <h2>2. No Harassment or Abuse</h2>
          <p>
            Harassment in any form is prohibited on Pryde Social. This includes:
          </p>
          <ul>
            <li><strong>Targeted Harassment:</strong> Repeatedly contacting, mentioning, or messaging someone who has asked you to stop</li>
            <li><strong>Sexual Harassment:</strong> Unwanted sexual advances, comments, or explicit content sent to others</li>
            <li><strong>Stalking:</strong> Obsessively following, monitoring, or contacting another user</li>
            <li><strong>Impersonation:</strong> Pretending to be someone else to deceive or harm</li>
            <li><strong>Brigading:</strong> Coordinating attacks or mass-reporting against a user</li>
          </ul>
          <p>
            If you feel uncomfortable with someone's behavior, use the Block feature and report them via our <Link to="/safety" className="legal-link">Safety & Reporting</Link> page.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Prohibited Content</h2>
          <p>
            <strong>3.1 Adult & Explicit Content</strong>
          </p>
          <ul>
            <li>Pornographic or sexually explicit images/videos</li>
            <li>Nude or partially nude content (exceptions for artistic/educational context with warnings)</li>
            <li>Sexual solicitation or escort services</li>
          </ul>

          <p>
            <strong>3.2 Violent & Graphic Content</strong>
          </p>
          <ul>
            <li>Images or videos depicting violence, gore, or death</li>
            <li>Animal cruelty or abuse</li>
            <li>Self-harm, suicide, or eating disorder content</li>
            <li>Glorification of violence or dangerous activities</li>
          </ul>

          <p>
            <strong>3.3 Hate Speech & Discrimination</strong>
          </p>
          <ul>
            <li>Content attacking people based on race, ethnicity, religion, gender, sexual orientation, disability, or other protected characteristics</li>
            <li>Holocaust denial, genocide denial, or historical revisionism promoting hate</li>
            <li>Symbols, imagery, or slogans associated with hate groups</li>
          </ul>

          <p>
            <strong>3.4 Illegal Activity</strong>
          </p>
          <ul>
            <li>Promoting, facilitating, or engaging in illegal activities</li>
            <li>Drug sales, trafficking, or abuse glorification</li>
            <li>Fraud, scams, or phishing attempts</li>
            <li>Sale of weapons, explosives, or regulated goods</li>
            <li>Copyright infringement or pirated content</li>
          </ul>

          <p>
            <strong>3.5 Spam & Manipulation</strong>
          </p>
          <ul>
            <li>Mass unsolicited messages or friend requests</li>
            <li>Fake accounts, bots, or automated posting</li>
            <li>Misleading links, clickbait, or malware distribution</li>
            <li>Artificial engagement (buying followers, likes, or views)</li>
            <li>Manipulated media (deepfakes) used to deceive</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Authentic Identity & Accounts</h2>
          <p>
            <strong>Be Real:</strong> Pryde Social values authentic connections. We encourage you to:
          </p>
          <ul>
            <li>Use your real name or a consistent username</li>
            <li>Represent yourself honestly in your profile</li>
            <li>Use a recognizable profile photo (not logos or fake images)</li>
          </ul>
          <p>
            <strong>Prohibited Practices:</strong>
          </p>
          <ul>
            <li><strong>Impersonation:</strong> Pretending to be someone else (celebrity, public figure, or another user)</li>
            <li><strong>Multiple Accounts:</strong> Creating multiple accounts to evade bans or manipulate systems</li>
            <li><strong>Age Misrepresentation:</strong> Lying about being 18+ (immediate ban if discovered)</li>
            <li><strong>Bot Accounts:</strong> Using automation to post, message, or interact</li>
          </ul>
          <p>
            <strong>Parody Accounts:</strong> Clearly label parody/fan accounts in your bio and username (e.g., "Parody of [Name]").
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Intellectual Property & Copyright</h2>
          <p>
            <strong>Respect Creators:</strong>
          </p>
          <ul>
            <li>Only post content you created or have permission to share</li>
            <li>Give credit when sharing others' work (tag the creator)</li>
            <li>Do not repost art, photos, or writing without permission</li>
            <li>Avoid uploading copyrighted music, movies, or TV clips</li>
          </ul>
          <p>
            <strong>DMCA Compliance:</strong> If your content is posted without permission, submit a takedown request via our <Link to="/contact" className="legal-link">Contact</Link> page. We will investigate and remove infringing content within 72 hours.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Privacy & Personal Information</h2>
          <p>
            <strong>Protect Privacy (Yours and Others'):</strong>
          </p>
          <ul>
            <li>Do not share others' personal information (addresses, phone numbers, IDs) without consent</li>
            <li>Do not screenshot or share private messages publicly without permission</li>
            <li>Respect boundaries when someone declines to share personal details</li>
            <li>Report doxxing or privacy violations immediately</li>
          </ul>
          <p>
            <strong>Your Privacy:</strong> Review your privacy settings in your account to control who can see your posts, friends, and profile information.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Safe & Healthy Interactions</h2>
          <p>
            <strong>Mental Health & Well-Being:</strong>
          </p>
          <ul>
            <li>Do not promote or glorify self-harm, suicide, or eating disorders</li>
            <li>If you encounter someone in crisis, encourage them to contact a crisis hotline (e.g., 988 Suicide & Crisis Lifeline in the US)</li>
            <li>Report content that promotes dangerous behavior</li>
          </ul>
          <p>
            <strong>Support Resources:</strong>
          </p>
          <ul>
            <li><strong>National Suicide Prevention Lifeline (US):</strong> 988</li>
            <li><strong>Crisis Text Line:</strong> Text HOME to 741741</li>
            <li><strong>International Crisis Lines:</strong> <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a></li>
          </ul>
          <p>
            <strong>Pryde Social is NOT a substitute for professional mental health care.</strong> If you or someone you know is in immediate danger, contact emergency services (911 in the US).
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Group Chats & Private Spaces</h2>
          <p>
            <strong>Respectful Participation:</strong>
          </p>
          <ul>
            <li>Follow the group's rules and norms</li>
            <li>Do not spam, flood, or derail conversations</li>
            <li>Respect the group admin's decisions</li>
            <li>Leave gracefully if the group isn't a good fit</li>
          </ul>
          <p>
            <strong>Group Admins:</strong> You are responsible for moderating your group and ensuring members follow Pryde Social's Community Guidelines. Groups that violate our policies may be removed.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Reporting Violations</h2>
          <p>
            If you see content or behavior that violates these guidelines:
          </p>
          <ul>
            <li><strong>Use the Report Button:</strong> Available on all posts, profiles, and messages</li>
            <li><strong>Visit Safety Center:</strong> <Link to="/safety" className="legal-link">Safety & Reporting</Link> for detailed instructions</li>
            <li><strong>Contact Support:</strong> <Link to="/contact" className="legal-link">Contact Us</Link> for serious concerns</li>
          </ul>
          <p>
            <strong>What Happens After a Report:</strong>
          </p>
          <ul>
            <li>Our Safety Team reviews all reports within 24-48 hours</li>
            <li>We may contact you for additional information</li>
            <li>Action may include content removal, warnings, or account suspension</li>
            <li>Serious violations (illegal activity, threats) are reported to law enforcement</li>
          </ul>
          <p>
            <strong>False Reporting:</strong> Abusing the report system to harass others or silence opinions you disagree with may result in your account being suspended.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Consequences for Violations</h2>
          <p>
            Violations of these Community Guidelines may result in:
          </p>
          <ul>
            <li><strong>First Offense:</strong> Warning notification with explanation</li>
            <li><strong>Second Offense:</strong> Content removal and 24-hour suspension</li>
            <li><strong>Third Offense:</strong> 7-day suspension and profile review</li>
            <li><strong>Severe Violations:</strong> Immediate permanent ban without warning</li>
          </ul>
          <p>
            <strong>Immediate Bans (No Warnings):</strong>
          </p>
          <ul>
            <li>Child exploitation or abuse content</li>
            <li>Terrorist content or extremist activity</li>
            <li>Doxxing or real-world threats</li>
            <li>Severe harassment or hate speech</li>
            <li>Illegal activity (drug trafficking, fraud, etc.)</li>
            <li>Repeated violations after multiple warnings</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>11. Appeals Process</h2>
          <p>
            If you believe your content was removed or account was suspended in error:
          </p>
          <ul>
            <li>Contact us via our <Link to="/contact" className="legal-link">Contact</Link> page</li>
            <li>Include your username and a detailed explanation</li>
            <li>We will review your appeal within 7 business days</li>
            <li>Our decision on appeals is final</li>
          </ul>
          <p>
            <strong>Note:</strong> Appeals for severe violations (illegal content, threats, abuse) are rarely overturned.
          </p>
        </section>

        <section className="legal-section">
          <h2>12. Platform Moderation</h2>
          <p>
            <strong>How We Moderate:</strong>
          </p>
          <ul>
            <li><strong>User Reports:</strong> Most moderation actions come from community reports</li>
            <li><strong>Automated Detection:</strong> AI tools flag potentially harmful content for review</li>
            <li><strong>Human Review:</strong> Our Safety Team makes final decisions on all enforcement actions</li>
            <li><strong>Proactive Monitoring:</strong> We may review public posts for policy violations</li>
          </ul>
          <p>
            <strong>What We Don't Moderate:</strong>
          </p>
          <ul>
            <li>Political opinions or debates (unless they violate hate speech policies)</li>
            <li>Unpopular or controversial views (protected under free expression)</li>
            <li>Satire or parody (if clearly labeled)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>13. Changes to Guidelines</h2>
          <p>
            We may update these Community Guidelines as our platform evolves. When we make significant changes:
          </p>
          <ul>
            <li>We will notify you via email or in-app notification</li>
            <li>Updated guidelines take effect immediately upon posting</li>
            <li>Continued use of the platform constitutes acceptance</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>14. Questions & Feedback</h2>
          <p>
            Have questions about these guidelines? Want to suggest improvements? Contact us:
          </p>
          <p className="contact-info">
            <strong>Email:</strong> community@prydesocial.com<br />
            <strong>Subject Line:</strong> Community Guidelines Inquiry<br />
            <strong>Contact Form:</strong> <Link to="/contact" className="legal-link">Visit our Contact Page</Link>
          </p>
        </section>

        <div className="legal-footer-note">
          <p>
            By using Pryde Social, you agree to follow these Community Guidelines. Together, we can build a safe, respectful, and vibrant community where everyone feels welcome.
          </p>
          <p className="last-updated">
            Last Updated: January 1, 2025
          </p>
        </div>
      </div>

      <div className="legal-nav-footer">
        <Link to="/" className="back-link">← Back to Home</Link>
        <div className="legal-links">
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/safety">Safety & Reporting</Link>
          <Link to="/contact">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}

export default Community;
