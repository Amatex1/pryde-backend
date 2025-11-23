import { Link } from 'react-router-dom';
import './Legal.css';

function Terms() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <h1>Terms of Service</h1>
        <p className="legal-subtitle">Effective Date: January 1, 2025</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            Welcome to Pryde Social! By accessing or using our platform, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any part of these terms, you may not use our service.
          </p>
          <p>
            Pryde Social reserves the right to modify these Terms at any time. We will notify users of significant changes via email or in-app notification. Your continued use of the service after such modifications constitutes acceptance of the updated terms.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Age Restriction & Verification</h2>
          <p>
            <strong>You must be at least 18 years of age to use Pryde Social.</strong> By creating an account, you represent and warrant that:
          </p>
          <ul>
            <li>You are 18 years of age or older</li>
            <li>You have the legal capacity to enter into binding contracts</li>
            <li>You will comply with all local, state, national, and international laws</li>
            <li>You will not misrepresent your age or identity</li>
          </ul>
          <p>
            Pryde Social reserves the right to verify user age and terminate accounts that violate this requirement. Providing false information about your age is a violation of these Terms and may result in immediate account suspension or termination.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Account Responsibilities</h2>
          <p>
            When you create an account on Pryde Social, you are responsible for:
          </p>
          <ul>
            <li><strong>Security:</strong> Maintaining the confidentiality of your password and account credentials</li>
            <li><strong>Accuracy:</strong> Providing accurate, current, and complete information during registration</li>
            <li><strong>Updates:</strong> Keeping your profile information up-to-date</li>
            <li><strong>Activity:</strong> All activities that occur under your account</li>
            <li><strong>Notifications:</strong> Immediately notifying us of any unauthorized use or security breach</li>
          </ul>
          <p>
            You may not:
          </p>
          <ul>
            <li>Create multiple accounts or impersonate others</li>
            <li>Share your account credentials with third parties</li>
            <li>Use automated systems (bots) to access the platform</li>
            <li>Sell, transfer, or assign your account to another person</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Acceptable Use Policy</h2>
          <p>
            Pryde Social is a community built on respect, safety, and authentic connections. You agree NOT to use the platform to:
          </p>
          <ul>
            <li><strong>Harass or Abuse:</strong> Post threatening, harassing, defamatory, or discriminatory content</li>
            <li><strong>Illegal Activity:</strong> Engage in or promote illegal activities, including fraud, theft, or distribution of illegal materials</li>
            <li><strong>Adult Content:</strong> Share pornographic, sexually explicit, or obscene content (violations result in immediate suspension)</li>
            <li><strong>Violence:</strong> Promote violence, self-harm, or harm to others</li>
            <li><strong>Spam:</strong> Send unsolicited messages, advertisements, or commercial content</li>
            <li><strong>Intellectual Property:</strong> Upload content that infringes on copyrights, trademarks, or other intellectual property rights</li>
            <li><strong>Hate Speech:</strong> Post content that promotes hate, discrimination, or intolerance based on race, religion, gender, sexual orientation, disability, or other protected characteristics</li>
            <li><strong>Privacy Violations:</strong> Share others' personal information without consent (doxxing)</li>
            <li><strong>Malware:</strong> Distribute viruses, malware, or malicious code</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>5. Content Ownership & License</h2>
          <p>
            <strong>Your Content:</strong> You retain all ownership rights to the content you upload to Pryde Social (posts, photos, messages, profile information). However, by uploading content, you grant Pryde Social a worldwide, non-exclusive, royalty-free license to:
          </p>
          <ul>
            <li>Display, reproduce, and distribute your content within the platform</li>
            <li>Store content using MongoDB and GridFS technology for delivery and backup</li>
            <li>Create backups and cache your content for performance optimization</li>
            <li>Moderate and remove content that violates our policies</li>
          </ul>
          <p>
            <strong>Platform Content:</strong> The Pryde Social name, logo, design, interface, and all proprietary features are owned by Pryde Social and protected by intellectual property laws. You may not copy, reproduce, or redistribute any platform content without written permission.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Data Storage & Image Uploads</h2>
          <p>
            Pryde Social uses the following technologies to store and deliver your data:
          </p>
          <ul>
            <li><strong>Database:</strong> MongoDB for user profiles, posts, messages, and metadata</li>
            <li><strong>Image Storage:</strong> GridFS (MongoDB's file storage system) for profile photos, cover photos, and uploaded images</li>
            <li><strong>Message Storage:</strong> Encrypted message history stored in MongoDB with read receipts and delivery tracking</li>
          </ul>
          <p>
            You acknowledge that:
          </p>
          <ul>
            <li>Images uploaded to Pryde Social are stored on our servers using GridFS</li>
            <li>We implement reasonable security measures but cannot guarantee absolute security</li>
            <li>You are responsible for backing up your own content</li>
            <li>We may compress or optimize images for performance without prior notice</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>7. Privacy & Messages</h2>
          <p>
            <strong>Message Privacy:</strong> Direct messages on Pryde Social are private between sender and recipient(s). However:
          </p>
          <ul>
            <li>Messages are stored in our MongoDB database for delivery and history purposes</li>
            <li>We may access messages in cases of abuse reports, legal obligations, or Terms violations</li>
            <li>Group chat messages are visible to all group members</li>
            <li>Read receipts and delivery status are tracked and visible to senders</li>
            <li>We do not sell or share your message content with third parties for advertising</li>
          </ul>
          <p>
            For full details on data collection and usage, please review our <Link to="/privacy" className="legal-link">Privacy Policy</Link>.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Reporting & Enforcement</h2>
          <p>
            Pryde Social takes violations of these Terms seriously. If you encounter inappropriate content or behavior:
          </p>
          <ul>
            <li>Use the "Report" button available on all posts and profiles</li>
            <li>Contact our Safety Team via the <Link to="/safety" className="legal-link">Safety & Reporting</Link> page</li>
            <li>For immediate safety concerns, contact local law enforcement first</li>
          </ul>
          <p>
            <strong>Enforcement Actions:</strong> Violations may result in:
          </p>
          <ul>
            <li>Warning notifications</li>
            <li>Content removal</li>
            <li>Temporary account suspension</li>
            <li>Permanent account termination</li>
            <li>Reporting to law enforcement (for illegal activities)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>9. Termination</h2>
          <p>
            <strong>By You:</strong> You may delete your account at any time through your Settings page. Upon deletion:
          </p>
          <ul>
            <li>Your profile and posts will be removed within 30 days</li>
            <li>Some data may be retained for legal compliance or fraud prevention</li>
            <li>Messages sent to other users may remain visible to recipients</li>
          </ul>
          <p>
            <strong>By Us:</strong> We reserve the right to suspend or terminate your account at any time for:
          </p>
          <ul>
            <li>Violations of these Terms</li>
            <li>Violations of our Community Guidelines</li>
            <li>Prolonged account inactivity</li>
            <li>Legal or regulatory requirements</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>10. Disclaimers & Limitation of Liability</h2>
          <p>
            <strong>Service Availability:</strong> Pryde Social is provided "AS IS" and "AS AVAILABLE" without warranties of any kind. We do not guarantee:
          </p>
          <ul>
            <li>Uninterrupted or error-free service</li>
            <li>Complete data security or backup</li>
            <li>Accuracy of user-generated content</li>
            <li>Compatibility with all devices or browsers</li>
          </ul>
          <p>
            <strong>No Emergency Services:</strong> Pryde Social is NOT an emergency service. If you or someone you know is in immediate danger, contact local emergency services (911 in the US) immediately.
          </p>
          <p>
            <strong>Limitation of Liability:</strong> To the maximum extent permitted by law, Pryde Social and its officers, directors, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform, including but not limited to:
          </p>
          <ul>
            <li>Loss of data or content</li>
            <li>Loss of profits or revenue</li>
            <li>Unauthorized access to your account</li>
            <li>Actions of other users</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>11. Intellectual Property & Copyright</h2>
          <p>
            Pryde Social respects intellectual property rights. If you believe content on our platform infringes your copyright:
          </p>
          <ul>
            <li>Submit a DMCA takedown notice to our <Link to="/contact" className="legal-link">Contact</Link> page</li>
            <li>Include the URL of the infringing content</li>
            <li>Provide proof of ownership</li>
            <li>Include your contact information</li>
          </ul>
          <p>
            We will investigate and remove infringing content within 72 hours of receiving a valid notice.
          </p>
        </section>

        <section className="legal-section">
          <h2>12. Third-Party Links & Services</h2>
          <p>
            Pryde Social may contain links to third-party websites or services. We are not responsible for:
          </p>
          <ul>
            <li>The content or privacy practices of external sites</li>
            <li>Transactions made with third-party services</li>
            <li>Damages resulting from your use of linked services</li>
          </ul>
          <p>
            We do not endorse or guarantee any third-party content linked on our platform.
          </p>
        </section>

        <section className="legal-section">
          <h2>13. Governing Law & Dispute Resolution</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law provisions.
          </p>
          <p>
            <strong>Dispute Resolution:</strong> Any disputes arising from these Terms or your use of Pryde Social shall be resolved through:
          </p>
          <ul>
            <li>Good faith negotiation between you and Pryde Social</li>
            <li>Binding arbitration if negotiation fails</li>
            <li>Small claims court (if eligible)</li>
          </ul>
          <p>
            You waive the right to participate in class-action lawsuits against Pryde Social.
          </p>
        </section>

        <section className="legal-section">
          <h2>14. Changes to Terms</h2>
          <p>
            We may update these Terms periodically. When we make material changes:
          </p>
          <ul>
            <li>We will update the "Effective Date" at the top of this page</li>
            <li>We will notify you via email or in-app notification</li>
            <li>Continued use after notification constitutes acceptance of new Terms</li>
          </ul>
          <p>
            If you do not agree to updated Terms, you must stop using the platform and delete your account.
          </p>
        </section>

        <section className="legal-section">
          <h2>15. Contact Information</h2>
          <p>
            For questions about these Terms of Service, please contact us via our <Link to="/contact" className="legal-link">Contact</Link> page or email us at:
          </p>
          <p className="contact-info">
            <strong>Email:</strong> legal@prydesocial.com<br />
            <strong>Subject Line:</strong> Terms of Service Inquiry
          </p>
        </section>

        <div className="legal-footer-note">
          <p>
            By using Pryde Social, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and our <Link to="/privacy" className="legal-link">Privacy Policy</Link>.
          </p>
          <p className="last-updated">
            Last Updated: January 1, 2025
          </p>
        </div>
      </div>

      <div className="legal-nav-footer">
        <Link to="/" className="back-link">← Back to Home</Link>
        <div className="legal-links">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/community">Community Guidelines</Link>
          <Link to="/safety">Safety & Reporting</Link>
          <Link to="/contact">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}

export default Terms;
