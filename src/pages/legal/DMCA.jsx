import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import './Legal.css';

function DMCA() {
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
        <h1>🌈 Pryde Social — DMCA Copyright Policy</h1>
        <p className="legal-subtitle">Last Updated: November 26, 2025</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>Introduction & Purpose</h2>
          <p>
            Pryde Social ("we", "our", "the platform") respects the intellectual property rights of creators, artists, and copyright holders. We expect all users to comply with applicable copyright laws, including the Australian Copyright Act and international copyright standards such as the Digital Millennium Copyright Act (DMCA).
          </p>
          <p>
            <strong>Pryde Social is a hobby-operated platform based in Australia. We do not maintain a physical mailing address for legal notices. All copyright notices must be submitted via email only.</strong>
          </p>
          <p>
            This DMCA Copyright Policy explains:
          </p>
          <ul>
            <li>How to submit a copyright takedown notice</li>
            <li>How Pryde Social responds once a notice is received</li>
            <li>How to submit a counter-notification if your content is wrongly removed</li>
            <li>Our repeat-infringer policy</li>
            <li>Consequences for filing false copyright claims</li>
          </ul>
          <p>
            If you believe someone is using your copyrighted work without permission, you can request removal by submitting a valid notice.
          </p>
        </section>

        <section className="legal-section">
          <h2>How to File a DMCA Takedown Notice</h2>
          <p>
            If you believe that content hosted on Pryde Social infringes your copyright, please send a takedown notice to:
          </p>
          <div className="contact-info">
            <p>
              <strong>📧 Email:</strong> <span className="contact-email">prydeapp-team@outlook.com</span><br />
              <strong>Subject Line:</strong> DMCA Takedown Notice – [Your Name]
            </p>
          </div>
          <p>
            <strong>To be valid, your notice must include all of the following:</strong>
          </p>

          <h3>A. Your Contact Information</h3>
          <ul>
            <li>Full name</li>
            <li>Email address</li>
            <li>Any additional contact details you wish to provide</li>
          </ul>

          <h3>B. Identification of the Copyrighted Work</h3>
          <p>
            Describe the copyrighted material you believe has been infringed.<br />
            <em>Example: "My photograph titled 'Summer Light', published in 2023."</em>
          </p>

          <h3>C. Identification of the Infringing Content</h3>
          <p>
            Provide the exact URL(s) of the content on Pryde Social that you believe infringes your rights.<br />
            <em>Example: "https://prydeapp.com/post/12345"</em>
          </p>

          <h3>D. Statement of Good Faith</h3>
          <p>
            "I have a good faith belief that the use of the copyrighted material described above is not authorized by the copyright owner, its agent, or the law."
          </p>

          <h3>E. Statement of Accuracy (Under Penalty of Perjury)</h3>
          <p>
            "The information in this notification is accurate, and under penalty of perjury, I am the copyright owner or am authorized to act on behalf of the copyright owner."
          </p>

          <h3>F. Electronic Signature</h3>
          <p>
            Type your full name.<br />
            <em>(Example: /s Jane Doe)</em>
          </p>
        </section>

        <section className="legal-section">
          <h2>What Happens After We Receive Your Notice</h2>
          <p>
            Once Pryde Social receives a valid notice:
          </p>

          <h3>Step 1 – Review (1–3 business days)</h3>
          <p>We verify your notice meets the DMCA requirements.</p>

          <h3>Step 2 – Content Removal (within 24–48 hours after validation)</h3>
          <p>If valid, the allegedly infringing content is removed or disabled.</p>

          <h3>Step 3 – Notify the User</h3>
          <p>We notify the user whose content was removed and provide them with your notice.</p>

          <h3>Step 4 – Counter-Notification Period (10–14 days)</h3>
          <p>The user may respond if they believe the removal was made in error.</p>

          <h3>Step 5 – Final Resolution</h3>
          <ul>
            <li><strong>If no counter-notification is filed</strong> → the content stays removed.</li>
            <li><strong>If a counter-notice is filed</strong> → content may be restored unless you initiate legal action.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>How to File a Counter-Notification (For Users)</h2>
          <p>
            If your content was removed and you believe it was taken down by mistake or due to misidentification, you can submit a counter-notification.
          </p>
          <div className="contact-info">
            <p>
              <strong>📧 Email:</strong> <span className="contact-email">prydeapp-team@outlook.com</span><br />
              <strong>Subject Line:</strong> DMCA Counter-Notification – [Your Username]
            </p>
          </div>
          <p>
            <strong>Your counter-notification must include:</strong>
          </p>

          <h3>A. Your Contact Information</h3>
          <p>Full name and email address.</p>

          <h3>B. Identification of Removed Content</h3>
          <p>Provide the URL(s) or description of the content before removal.</p>

          <h3>C. Statement Under Penalty of Perjury</h3>
          <p>
            "I swear, under penalty of perjury, that I have a good faith belief that the material was removed or disabled as a result of a mistake or misidentification."
          </p>

          <h3>D. Consent to Jurisdiction</h3>
          <p>
            "I consent to resolve this matter under the applicable laws of my own region or country."
          </p>
          <p className="legal-note">
            <em>(This replaces U.S. District Court language, since Pryde Social is not a U.S. company and is hobby-operated.)</em>
          </p>

          <h3>E. Electronic Signature</h3>
          <p>Your typed full name.</p>
        </section>

        <section className="legal-section">
          <h2>Repeat Infringer Policy</h2>
          <p>
            Pryde Social may permanently terminate accounts belonging to users who repeatedly infringe copyright.
          </p>
          <p>
            <strong>We operate a three-strike system:</strong>
          </p>
          <ul>
            <li><strong>Strike 1:</strong> Content removed, warning issued</li>
            <li><strong>Strike 2:</strong> Content removed, temporary suspension</li>
            <li><strong>Strike 3:</strong> Permanent ban</li>
          </ul>
          <p>
            Strikes expire after 6 months with no further copyright issues.
          </p>
        </section>

        <section className="legal-section">
          <h2>Misuse of the DMCA Process</h2>
          <p>
            Filing false, fraudulent, or abusive DMCA notices or counter-notices is illegal and may result in:
          </p>
          <ul>
            <li>Legal liability</li>
            <li>Account suspension</li>
            <li>Account termination</li>
            <li>Potential civil penalties under applicable laws</li>
          </ul>
          <p>
            <strong>Please ensure your claim is legitimate before submitting.</strong>
          </p>
        </section>

        <section className="legal-section">
          <h2>Fair Use and Exceptions</h2>
          <p>
            Not all uses of copyrighted material constitute infringement. Content may be protected by:
          </p>
          <ul>
            <li><strong>Fair use</strong></li>
            <li><strong>Parody</strong></li>
            <li><strong>Commentary/criticism</strong></li>
            <li><strong>Transformative use</strong></li>
            <li><strong>User-granted permissions</strong></li>
          </ul>
          <p>
            If you believe your content qualifies as fair use, you may explain this in your counter-notification.
          </p>
        </section>

        <section className="legal-section">
          <h2>DMCA Contact Information</h2>
          <p>
            All DMCA notices, counter-notices, and copyright inquiries should be sent to:
          </p>
          <div className="contact-info">
            <p>
              <strong>📧 Email:</strong> <span className="contact-email">prydeapp-team@outlook.com</span>
            </p>
          </div>
          <p className="legal-note">
            <em>Pryde Social does not maintain a physical mailing address or registered DMCA agent due to its status as a hobby-operated platform.</em>
          </p>
        </section>

        <div className="legal-footer-note">
          <p>
            <strong>Questions about DMCA or copyright?</strong> Contact <span className="contact-email">prydeapp-team@outlook.com</span> or consult with a copyright attorney.
          </p>
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

export default DMCA;

