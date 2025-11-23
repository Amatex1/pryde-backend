import { Link } from 'react-router-dom';
import { useState } from 'react';
import './Legal.css';

function Safety() {
  const [reportType, setReportType] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const handleReportSubmit = (e) => {
    e.preventDefault();
    // In a real implementation, this would send the report to the backend
    console.log('Report submitted:', { reportType, reportDetails });
    setReportSubmitted(true);
    setTimeout(() => {
      setReportType('');
      setReportDetails('');
      setReportSubmitted(false);
    }, 3000);
  };

  return (
    <div className="legal-page">
      <div className="legal-header safety-header">
        <h1>Safety & Reporting Center</h1>
        <p className="legal-subtitle">Your Safety is Our Priority</p>
      </div>

      <div className="legal-content">
        <section className="legal-section emergency-section">
          <div className="emergency-banner">
            <h2>⚠️ Emergency Resources</h2>
            <p>
              <strong>If you or someone you know is in immediate danger, contact emergency services immediately.</strong>
            </p>
            <ul className="emergency-list">
              <li><strong>Emergency Services (US):</strong> 911</li>
              <li><strong>National Suicide Prevention Lifeline:</strong> 988</li>
              <li><strong>Crisis Text Line:</strong> Text HOME to 741741</li>
              <li><strong>National Domestic Violence Hotline:</strong> 1-800-799-7233</li>
              <li><strong>RAINN Sexual Assault Hotline:</strong> 1-800-656-4673</li>
              <li><strong>International Crisis Lines:</strong> <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a></li>
            </ul>
            <p className="emergency-note">
              <strong>Pryde Social is NOT an emergency service.</strong> Always contact local authorities for immediate threats or emergencies.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>How to Report Violations</h2>
          <p>
            Pryde Social relies on our community to help identify and report content or behavior that violates our <Link to="/community" className="legal-link">Community Guidelines</Link>. Here's how to report:
          </p>
          
          <div className="report-methods">
            <div className="report-method">
              <h3>1. Report a Post</h3>
              <ul>
                <li>Click the three-dot menu (⋯) on any post</li>
                <li>Select "Report Post"</li>
                <li>Choose the reason for reporting</li>
                <li>Submit with optional details</li>
              </ul>
            </div>

            <div className="report-method">
              <h3>2. Report a Profile</h3>
              <ul>
                <li>Visit the user's profile page</li>
                <li>Click the three-dot menu (⋯) next to their name</li>
                <li>Select "Report User"</li>
                <li>Describe the violation</li>
              </ul>
            </div>

            <div className="report-method">
              <h3>3. Report a Message</h3>
              <ul>
                <li>Open the conversation</li>
                <li>Long-press or right-click the message</li>
                <li>Select "Report Message"</li>
                <li>Provide context for the report</li>
              </ul>
            </div>

            <div className="report-method">
              <h3>4. Report via This Form</h3>
              <p>Use the form below for detailed reports or issues not covered above.</p>
            </div>
          </div>
        </section>

        <section className="legal-section">
          <h2>Submit a Safety Report</h2>
          <div className="report-form-container">
            <form className="report-form" onSubmit={handleReportSubmit}>
              <div className="form-group">
                <label htmlFor="reportType">Type of Report</label>
                <select
                  id="reportType"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  required
                >
                  <option value="">-- Select Report Type --</option>
                  <option value="harassment">Harassment or Bullying</option>
                  <option value="hate-speech">Hate Speech or Discrimination</option>
                  <option value="violence">Violence or Threats</option>
                  <option value="sexual-content">Inappropriate Sexual Content</option>
                  <option value="spam">Spam or Scam</option>
                  <option value="impersonation">Impersonation</option>
                  <option value="privacy">Privacy Violation (Doxxing)</option>
                  <option value="self-harm">Self-Harm or Suicide Concern</option>
                  <option value="illegal">Illegal Activity</option>
                  <option value="copyright">Copyright Infringement</option>
                  <option value="underage">Underage User (Under 18)</option>
                  <option value="other">Other Violation</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="reportDetails">Report Details</label>
                <textarea
                  id="reportDetails"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Please provide details: username, post URL, description of violation, and any other relevant information..."
                  rows="8"
                  required
                />
              </div>

              <button type="submit" className="submit-report-btn">
                Submit Report
              </button>

              {reportSubmitted && (
                <div className="report-success">
                  ✓ Report submitted successfully! Our Safety Team will review it within 24-48 hours.
                </div>
              )}
            </form>

            <div className="report-note">
              <p>
                <strong>What Happens Next:</strong>
              </p>
              <ul>
                <li>Our Safety Team reviews all reports within 24-48 hours</li>
                <li>We may contact you for additional information</li>
                <li>Action taken may include content removal, warnings, or account suspension</li>
                <li>You'll receive a notification once the review is complete</li>
                <li>Serious violations (illegal activity, threats) are reported to law enforcement</li>
              </ul>
              <p className="confidential-note">
                <strong>Your report is confidential.</strong> The reported user will not be notified of who reported them.
              </p>
            </div>
          </div>
        </section>

        <section className="legal-section">
          <h2>Report Categories Explained</h2>
          
          <div className="report-category">
            <h3>Harassment or Bullying</h3>
            <p>Repeated unwanted contact, intimidation, threats, or targeted attacks against an individual.</p>
          </div>

          <div className="report-category">
            <h3>Hate Speech or Discrimination</h3>
            <p>Content attacking people based on race, ethnicity, religion, gender, sexual orientation, disability, or other protected characteristics.</p>
          </div>

          <div className="report-category">
            <h3>Violence or Threats</h3>
            <p>Threats of physical harm, violent content, or graphic imagery depicting violence.</p>
          </div>

          <div className="report-category">
            <h3>Inappropriate Sexual Content</h3>
            <p>Pornographic, sexually explicit, or non-consensual sexual content (e.g., revenge porn).</p>
          </div>

          <div className="report-category">
            <h3>Spam or Scam</h3>
            <p>Unsolicited advertising, fake giveaways, phishing attempts, or fraudulent schemes.</p>
          </div>

          <div className="report-category">
            <h3>Impersonation</h3>
            <p>Pretending to be someone else (celebrity, public figure, or another user) to deceive others.</p>
          </div>

          <div className="report-category">
            <h3>Privacy Violation (Doxxing)</h3>
            <p>Sharing someone's personal information (address, phone number, ID) without consent.</p>
          </div>

          <div className="report-category">
            <h3>Self-Harm or Suicide Concern</h3>
            <p>Content promoting self-harm, suicide, or a user expressing intent to harm themselves.</p>
          </div>

          <div className="report-category">
            <h3>Illegal Activity</h3>
            <p>Drug trafficking, fraud, weapons sales, or other criminal activity.</p>
          </div>

          <div className="report-category">
            <h3>Copyright Infringement</h3>
            <p>Unauthorized use of copyrighted material (art, music, writing) without permission.</p>
          </div>

          <div className="report-category">
            <h3>Underage User</h3>
            <p>Suspicion that a user is under 18 years of age (Pryde Social is 18+ only).</p>
          </div>
        </section>

        <section className="legal-section">
          <h2>Safety Tools & Features</h2>
          
          <div className="safety-tool">
            <h3>🚫 Block a User</h3>
            <p>
              Blocking prevents a user from contacting you, seeing your posts, or sending friend requests.
            </p>
            <p><strong>How to Block:</strong> Profile → Three-dot menu (⋯) → Block User</p>
          </div>

          <div className="safety-tool">
            <h3>🔇 Mute a User</h3>
            <p>
              Muting hides a user's posts from your feed without unfriending them.
            </p>
            <p><strong>How to Mute:</strong> Post → Three-dot menu (⋯) → Mute User</p>
          </div>

          <div className="safety-tool">
            <h3>🔒 Privacy Settings</h3>
            <p>
              Control who can see your posts, send you messages, and view your profile.
            </p>
            <p><strong>Where:</strong> Settings → Privacy</p>
          </div>

          <div className="safety-tool">
            <h3>✉️ Message Filtering</h3>
            <p>
              Automatically filter message requests from non-friends or block inappropriate words.
            </p>
            <p><strong>Where:</strong> Settings → Messages</p>
          </div>

          <div className="safety-tool">
            <h3>🔔 Notification Control</h3>
            <p>
              Mute notifications from specific users or topics that bother you.
            </p>
            <p><strong>Where:</strong> Settings → Notifications</p>
          </div>
        </section>

        <section className="legal-section">
          <h2>Staying Safe Online</h2>
          <p>
            <strong>Best Practices for Your Safety:</strong>
          </p>
          <ul>
            <li><strong>Protect Your Password:</strong> Use a strong, unique password and enable two-factor authentication (if available)</li>
            <li><strong>Be Cautious with Links:</strong> Don't click suspicious links or download files from strangers</li>
            <li><strong>Verify Identities:</strong> If someone claims to be someone you know, verify through another channel (e.g., phone call)</li>
            <li><strong>Don't Share Sensitive Info:</strong> Avoid sharing addresses, phone numbers, financial details, or IDs publicly</li>
            <li><strong>Meet Safely:</strong> If meeting someone in person, choose public places and tell a friend</li>
            <li><strong>Trust Your Instincts:</strong> If something feels off, block the user and report them</li>
            <li><strong>Educate Yourself:</strong> Learn about common scams (catfishing, phishing, romance scams)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Mental Health Resources</h2>
          <p>
            If you or someone you know is struggling with mental health, these resources can help:
          </p>
          <ul>
            <li><strong>National Suicide Prevention Lifeline (US):</strong> Call or text 988</li>
            <li><strong>Crisis Text Line:</strong> Text HOME to 741741</li>
            <li><strong>SAMHSA National Helpline (Substance Abuse):</strong> 1-800-662-4357</li>
            <li><strong>NAMI Helpline (Mental Health):</strong> 1-800-950-6264</li>
            <li><strong>The Trevor Project (LGBTQ+ Youth):</strong> 1-866-488-7386</li>
            <li><strong>Veterans Crisis Line:</strong> 1-800-273-8255 (Press 1)</li>
            <li><strong>International Resources:</strong> <a href="https://www.iasp.info/resources/Crisis_Centres/" target="_blank" rel="noopener noreferrer">IASP Crisis Centers</a></li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>For Parents & Guardians</h2>
          <p>
            While Pryde Social is 18+, we understand parents may want to verify:
          </p>
          <ul>
            <li>If you suspect someone under 18 is using the platform, report them immediately</li>
            <li>We will investigate and terminate accounts of underage users</li>
            <li>Parents can contact us at <strong>safety@prydesocial.com</strong> for verification</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Law Enforcement Requests</h2>
          <p>
            Pryde Social cooperates with law enforcement in cases involving:
          </p>
          <ul>
            <li>Threats of violence or terrorism</li>
            <li>Child exploitation</li>
            <li>Human trafficking</li>
            <li>Drug trafficking or organized crime</li>
            <li>Fraud or financial crimes</li>
          </ul>
          <p>
            <strong>Law Enforcement Contact:</strong> legal@prydesocial.com
          </p>
          <p>
            We respond to valid legal requests (subpoenas, court orders, warrants) in accordance with applicable laws.
          </p>
        </section>

        <section className="legal-section">
          <h2>Contact Our Safety Team</h2>
          <p>
            For safety concerns not covered by the report form above, contact us:
          </p>
          <p className="contact-info">
            <strong>Email:</strong> safety@prydesocial.com<br />
            <strong>Subject Line:</strong> Safety Concern - [Your Issue]<br />
            <strong>General Contact:</strong> <Link to="/contact" className="legal-link">Visit our Contact Page</Link>
          </p>
          <p>
            <strong>Response Time:</strong> We aim to respond to all safety reports within 24-48 hours. Urgent threats are prioritized and reviewed immediately.
          </p>
        </section>

        <div className="legal-footer-note">
          <p>
            Your safety is our top priority. Together, we can build a community where everyone feels secure, respected, and supported.
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
          <Link to="/community">Community Guidelines</Link>
          <Link to="/contact">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}

export default Safety;
