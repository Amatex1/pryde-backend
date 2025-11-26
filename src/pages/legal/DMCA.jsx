import { Link } from 'react-router-dom';
import './Legal.css';

function DMCA() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <h1>DMCA Copyright Policy</h1>
        <p className="legal-subtitle">Digital Millennium Copyright Act Compliance</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>1. Copyright Infringement Policy</h2>
          <p>
            Pryde Social respects the intellectual property rights of others and expects our users to do the same. We comply with the Digital Millennium Copyright Act (DMCA) and will respond to valid copyright infringement notices.
          </p>
          <p>
            <strong>Our Policy:</strong>
          </p>
          <ul>
            <li>We remove or disable access to content that infringes copyright when properly notified</li>
            <li>We terminate accounts of repeat infringers</li>
            <li>We provide a counter-notification process for users who believe content was wrongly removed</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>2. How to File a DMCA Takedown Notice</h2>
          <p>
            If you believe content on Pryde Social infringes your copyright, submit a DMCA takedown notice to our designated Copyright Agent.
          </p>
          <p>
            <strong>Email:</strong> legal@prydesocial.com<br />
            <strong>Subject Line:</strong> DMCA Takedown Notice - [Your Name]
          </p>
          <p>
            <strong>Your notice must include ALL of the following information:</strong>
          </p>
          <ol>
            <li><strong>Your Contact Information:</strong> Full name, mailing address, phone number, and email address</li>
            <li><strong>Identification of Copyrighted Work:</strong> Describe the copyrighted work you claim has been infringed. If multiple works, provide a representative list.</li>
            <li><strong>Identification of Infringing Material:</strong> Provide the URL(s) of the specific post(s), image(s), or content on Pryde Social that you claim is infringing. Be as specific as possible.</li>
            <li><strong>Statement of Good Faith:</strong> Include this statement: "I have a good faith belief that the use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law."</li>
            <li><strong>Statement of Accuracy:</strong> Include this statement: "The information in this notification is accurate, and under penalty of perjury, I am the copyright owner or authorized to act on behalf of the copyright owner."</li>
            <li><strong>Your Signature:</strong> Physical or electronic signature of the copyright owner or authorized representative</li>
          </ol>
          <p>
            <strong>Mailing Address for DMCA Notices:</strong>
          </p>
          <div className="mailing-address">
            <p>
              <strong>Pryde Social - DMCA Agent</strong><br />
              Attn: Copyright Infringement Claims<br />
              123 Social Network Lane<br />
              San Francisco, CA 94102<br />
              United States
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>3. What Happens After You File a Notice</h2>
          <p>
            Once we receive a valid DMCA takedown notice:
          </p>
          <ol>
            <li><strong>Review (1-3 business days):</strong> We review the notice to ensure it meets DMCA requirements</li>
            <li><strong>Removal (24-48 hours):</strong> If valid, we remove or disable access to the allegedly infringing content</li>
            <li><strong>User Notification:</strong> We notify the user who posted the content that it was removed due to a DMCA claim</li>
            <li><strong>Counter-Notification Period (10-14 days):</strong> The user has the right to file a counter-notification if they believe the removal was a mistake</li>
            <li><strong>Restoration or Permanent Removal:</strong> If no counter-notification is filed, the content remains removed. If a counter-notification is filed, we may restore the content unless you file a lawsuit.</li>
          </ol>
        </section>

        <section className="legal-section">
          <h2>4. Counter-Notification (For Users)</h2>
          <p>
            If your content was removed due to a DMCA claim and you believe it was removed by mistake or misidentification, you can file a counter-notification.
          </p>
          <p>
            <strong>Email:</strong> legal@prydesocial.com<br />
            <strong>Subject Line:</strong> DMCA Counter-Notification - [Your Username]
          </p>
          <p>
            <strong>Your counter-notification must include:</strong>
          </p>
          <ol>
            <li><strong>Your Contact Information:</strong> Full name, mailing address, phone number, and email address</li>
            <li><strong>Identification of Removed Content:</strong> Describe the content that was removed and where it appeared before removal (URL or description)</li>
            <li><strong>Statement Under Penalty of Perjury:</strong> "I swear, under penalty of perjury, that I have a good faith belief that the material was removed or disabled as a result of mistake or misidentification."</li>
            <li><strong>Consent to Jurisdiction:</strong> "I consent to the jurisdiction of the Federal District Court for the judicial district in which my address is located (or San Francisco, CA if outside the U.S.), and I will accept service of process from the person who filed the original DMCA notice or their agent."</li>
            <li><strong>Your Signature:</strong> Physical or electronic signature</li>
          </ol>
          <p>
            <strong>What Happens Next:</strong>
          </p>
          <ul>
            <li>We forward your counter-notification to the original complainant</li>
            <li>If they do not file a lawsuit within 10-14 business days, we may restore your content</li>
            <li>If they file a lawsuit, the content remains removed pending court resolution</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>5. Repeat Infringer Policy</h2>
          <p>
            Pryde Social has a policy of terminating accounts of users who repeatedly infringe copyright.
          </p>
          <p>
            <strong>Strikes System:</strong>
          </p>
          <ul>
            <li><strong>1st Strike:</strong> Content removed, warning issued</li>
            <li><strong>2nd Strike:</strong> Content removed, 7-day suspension</li>
            <li><strong>3rd Strike:</strong> Account permanently terminated</li>
          </ul>
          <p>
            Strikes expire after 6 months if no further infringements occur. Accounts terminated for repeat infringement cannot be reinstated.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Misuse of DMCA Process</h2>
          <p>
            <strong>Warning:</strong> Filing a false or fraudulent DMCA notice is illegal and may result in:
          </p>
          <ul>
            <li>Liability for damages (including attorney's fees) under Section 512(f) of the DMCA</li>
            <li>Perjury charges (DMCA notices are made under penalty of perjury)</li>
            <li>Termination of your Pryde Social account</li>
          </ul>
          <p>
            <strong>Before filing a DMCA notice:</strong>
          </p>
          <ul>
            <li>Ensure you own the copyright or are authorized to act on behalf of the owner</li>
            <li>Verify that the content actually infringes your copyright (fair use may apply)</li>
            <li>Consider contacting the user directly to resolve the issue</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>7. Fair Use & Exceptions</h2>
          <p>
            Not all uses of copyrighted material are infringement. The following may qualify as fair use:
          </p>
          <ul>
            <li><strong>Commentary & Criticism:</strong> Using excerpts to comment on or critique the work</li>
            <li><strong>Parody:</strong> Transformative works that parody the original</li>
            <li><strong>News Reporting:</strong> Using content for news or educational purposes</li>
            <li><strong>Transformative Use:</strong> Creating new meaning or message from the original</li>
          </ul>
          <p>
            Fair use is determined on a case-by-case basis. If you believe your use qualifies as fair use, explain this in your counter-notification.
          </p>
        </section>

        <div className="legal-footer-note">
          <p>
            <strong>Questions about DMCA or copyright?</strong> Contact legal@prydesocial.com or consult with a copyright attorney.
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
          <Link to="/legal-requests">Legal Requests</Link>
          <Link to="/contact">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}

export default DMCA;

