import { Link } from 'react-router-dom';
import './Legal.css';

function Privacy() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <h1>Privacy Policy</h1>
        <p className="legal-subtitle">Effective Date: January 1, 2025</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>1. Introduction</h2>
          <p>
            At Pryde Social, your privacy is our priority. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our platform. By using Pryde Social, you consent to the practices described in this policy.
          </p>
          <p>
            <strong>We do not sell your personal data to third parties.</strong> Your information is used solely to provide, improve, and secure our services.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Information We Collect</h2>
          <p>
            <strong>2.1 Account Information</strong>
          </p>
          <p>
            When you create a Pryde Social account, we collect:
          </p>
          <ul>
            <li><strong>Email Address:</strong> Required for account creation, login, and communication</li>
            <li><strong>Password:</strong> Stored in encrypted form (bcrypt hashing) for security</li>
            <li><strong>Display Name:</strong> Your chosen username visible to other users</li>
            <li><strong>Age Verification:</strong> Confirmation that you are 18+ (stored as boolean flag)</li>
            <li><strong>Terms Acceptance:</strong> Timestamp of when you accepted our Terms of Service</li>
          </ul>

          <p>
            <strong>2.2 Profile Information</strong>
          </p>
          <ul>
            <li><strong>Profile Photo:</strong> Uploaded images stored via GridFS (MongoDB's file storage)</li>
            <li><strong>Cover Photo:</strong> Header image for your profile, stored via GridFS</li>
            <li><strong>Bio:</strong> Optional text description you provide</li>
            <li><strong>Location:</strong> Optional city/region information</li>
            <li><strong>Website:</strong> Optional personal website link</li>
          </ul>

          <p>
            <strong>2.3 Content & Activity</strong>
          </p>
          <ul>
            <li><strong>Posts:</strong> Text, images, and metadata of posts you create</li>
            <li><strong>Messages:</strong> Direct messages and group chat content stored in MongoDB</li>
            <li><strong>Friend Requests:</strong> Connections you make, pending requests, and friend list</li>
            <li><strong>Reactions:</strong> Likes, comments, and other interactions with content</li>
            <li><strong>Uploads:</strong> Images and attachments sent via messages or posts (stored via GridFS)</li>
          </ul>

          <p>
            <strong>2.4 Technical & Usage Data</strong>
          </p>
          <ul>
            <li><strong>IP Address:</strong> Logged for security, fraud prevention, and analytics</li>
            <li><strong>Device Information:</strong> Browser type, operating system, device model</li>
            <li><strong>Session Data:</strong> Login timestamps, JWT tokens (for authentication)</li>
            <li><strong>Online Status:</strong> Presence information (online/offline) for real-time features</li>
            <li><strong>Push Notification Tokens:</strong> If you enable push notifications</li>
            <li><strong>Cookies:</strong> Used for session management and preferences (see Cookie Policy below)</li>
          </ul>

          <p>
            <strong>2.5 Information from Others</strong>
          </p>
          <ul>
            <li>When someone tags you in a post or sends you a friend request</li>
            <li>When you are mentioned in messages or group chats</li>
            <li>When someone reports your content or profile</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. How We Use Your Information</h2>
          <p>
            Pryde Social uses your data to:
          </p>
          <ul>
            <li><strong>Provide Services:</strong> Enable account creation, login, messaging, friend connections, and content sharing</li>
            <li><strong>Personalize Experience:</strong> Display relevant content, friends, and recommendations</li>
            <li><strong>Communication:</strong> Send account notifications, friend requests, messages, and platform updates</li>
            <li><strong>Security & Safety:</strong> Detect fraud, prevent abuse, enforce Community Guidelines, and protect users</li>
            <li><strong>Improve Platform:</strong> Analyze usage patterns to enhance features and fix bugs</li>
            <li><strong>Legal Compliance:</strong> Respond to legal requests, enforce Terms of Service, and comply with regulations</li>
            <li><strong>Real-Time Features:</strong> Enable Socket.IO connections for live chat, notifications, and presence tracking</li>
            <li><strong>Push Notifications:</strong> Send optional browser notifications for messages and alerts (Web Push API)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Data Storage & Security</h2>
          <p>
            <strong>4.1 Storage Infrastructure</strong>
          </p>
          <ul>
            <li><strong>Database:</strong> MongoDB stores user profiles, posts, messages, friend requests, notifications, and group chats</li>
            <li><strong>Image Storage:</strong> GridFS (MongoDB's file storage system) stores profile photos, cover photos, and uploaded images</li>
            <li><strong>Hosting:</strong> Backend hosted on Render.com (https://pryde-social.onrender.com)</li>
            <li><strong>Frontend:</strong> React app hosted on Blink (https://pryde-social-fullstack-qut6su09.sites.blink.new)</li>
          </ul>

          <p>
            <strong>4.2 Security Measures</strong>
          </p>
          <ul>
            <li><strong>Encryption:</strong> Passwords are hashed using bcrypt (industry-standard)</li>
            <li><strong>JWT Authentication:</strong> Secure token-based authentication for API access</li>
            <li><strong>HTTPS:</strong> All data transmission is encrypted via SSL/TLS</li>
            <li><strong>Access Control:</strong> Only authorized personnel can access backend systems</li>
            <li><strong>Rate Limiting:</strong> Protection against brute-force attacks and spam</li>
            <li><strong>Regular Backups:</strong> MongoDB backups to prevent data loss</li>
          </ul>

          <p>
            <strong>Important:</strong> While we implement industry-standard security measures, no system is 100% secure. You are responsible for keeping your password confidential and logging out of shared devices.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Message Privacy & Read Receipts</h2>
          <p>
            <strong>5.1 Direct Messages</strong>
          </p>
          <ul>
            <li>Messages are private between sender and recipient(s)</li>
            <li>Stored in MongoDB for message history and delivery</li>
            <li>Not used for advertising or sold to third parties</li>
            <li>Read receipts show when messages are delivered and read</li>
            <li>Typing indicators show when someone is typing in real-time</li>
          </ul>

          <p>
            <strong>5.2 Group Chats</strong>
          </p>
          <ul>
            <li>Visible to all members of the group</li>
            <li>Admin can add/remove members and update group info</li>
            <li>Message history is available to new members who join</li>
            <li>Leaving a group removes your access to future messages</li>
          </ul>

          <p>
            <strong>5.3 Message Retention</strong>
          </p>
          <ul>
            <li>Messages are stored indefinitely unless you delete them</li>
            <li>Deleting a message removes it from your view but may remain visible to recipients</li>
            <li>We may access messages for abuse investigations or legal compliance</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>6. Data Sharing & Third Parties</h2>
          <p>
            <strong>We do NOT sell your personal data.</strong> We may share your information only in the following cases:
          </p>
          <ul>
            <li><strong>With Other Users:</strong> Your profile, posts, and friend connections are visible to other users based on your privacy settings</li>
            <li><strong>Service Providers:</strong> MongoDB (database), Render (hosting), and infrastructure providers who help us operate the platform</li>
            <li><strong>Legal Obligations:</strong> When required by law, court order, or government request</li>
            <li><strong>Safety & Enforcement:</strong> To investigate abuse reports, enforce Terms of Service, or protect users from harm</li>
            <li><strong>Business Transfers:</strong> If Pryde Social is acquired or merged, your data may be transferred to the new owner</li>
          </ul>
          <p>
            <strong>Third-Party Links:</strong> Our platform may contain links to external websites. We are not responsible for the privacy practices of third-party sites.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Your Privacy Rights</h2>
          <p>
            You have the following rights regarding your data:
          </p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your personal data stored on Pryde Social</li>
            <li><strong>Update:</strong> Edit your profile information at any time via Settings</li>
            <li><strong>Delete:</strong> Delete your account and associated data (may take up to 30 days)</li>
            <li><strong>Export:</strong> Request a downloadable archive of your posts and messages</li>
            <li><strong>Restrict Processing:</strong> Limit how we use certain data (e.g., disable push notifications)</li>
            <li><strong>Object:</strong> Opt-out of certain data processing activities</li>
          </ul>
          <p>
            To exercise these rights, visit your Settings page or contact us via our <Link to="/contact" className="legal-link">Contact</Link> page.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Data Retention</h2>
          <p>
            We retain your data for as long as you maintain an active account. When you delete your account:
          </p>
          <ul>
            <li>Profile and posts are removed within 30 days</li>
            <li>Messages you sent may remain visible to recipients</li>
            <li>Some data may be retained for legal compliance, fraud prevention, or security purposes</li>
            <li>Backups may contain data for up to 90 days</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>9. Children's Privacy (COPPA Compliance)</h2>
          <p>
            Pryde Social is <strong>strictly for users 18 years of age and older</strong>. We do not knowingly collect personal information from anyone under 18.
          </p>
          <p>
            If we discover that a user is under 18:
          </p>
          <ul>
            <li>The account will be immediately suspended</li>
            <li>All associated data will be deleted within 30 days</li>
            <li>Parents/guardians can contact us to verify deletion</li>
          </ul>
          <p>
            If you believe a user is under 18, please report them via our <Link to="/safety" className="legal-link">Safety & Reporting</Link> page.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Cookies & Tracking Technologies</h2>
          <p>
            Pryde Social uses cookies and similar technologies for:
          </p>
          <ul>
            <li><strong>Authentication:</strong> JWT tokens stored in localStorage to keep you logged in</li>
            <li><strong>Preferences:</strong> Remember your theme, language, and settings</li>
            <li><strong>Session Management:</strong> Maintain your login state across page refreshes</li>
            <li><strong>Analytics:</strong> Understand how users interact with the platform (anonymized data)</li>
          </ul>
          <p>
            You can disable cookies in your browser settings, but this may limit functionality. We do not use third-party advertising cookies or trackers.
          </p>
        </section>

        <section className="legal-section">
          <h2>11. International Users & GDPR</h2>
          <p>
            Pryde Social is based in the United States. If you access the platform from outside the US:
          </p>
          <ul>
            <li>Your data may be transferred to and stored on servers in the US</li>
            <li>By using Pryde Social, you consent to this transfer</li>
            <li>We comply with applicable data protection laws, including GDPR for EU users</li>
          </ul>
          <p>
            <strong>GDPR Rights (EU Users):</strong> If you are in the European Union, you have additional rights under GDPR:
          </p>
          <ul>
            <li>Right to data portability</li>
            <li>Right to object to automated decision-making</li>
            <li>Right to lodge a complaint with your data protection authority</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>12. Push Notifications</h2>
          <p>
            If you enable push notifications:
          </p>
          <ul>
            <li>We collect your browser push token (Web Push API)</li>
            <li>Tokens are stored securely in MongoDB</li>
            <li>Used only to send you notifications about messages, friend requests, and platform updates</li>
            <li>You can disable push notifications anytime in Settings</li>
            <li>Unsubscribing removes your token from our database</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>13. Changes to Privacy Policy</h2>
          <p>
            We may update this Privacy Policy periodically. When we make material changes:
          </p>
          <ul>
            <li>The "Effective Date" at the top will be updated</li>
            <li>You will receive an email or in-app notification</li>
            <li>Continued use after notification constitutes acceptance</li>
          </ul>
          <p>
            We encourage you to review this policy regularly to stay informed about how we protect your data.
          </p>
        </section>

        <section className="legal-section">
          <h2>14. Contact Us</h2>
          <p>
            If you have questions or concerns about this Privacy Policy, your data, or how we process information, please contact us:
          </p>
          <p className="contact-info">
            <strong>Email:</strong> privacy@prydesocial.com<br />
            <strong>Subject Line:</strong> Privacy Policy Inquiry<br />
            <strong>Contact Form:</strong> <Link to="/contact" className="legal-link">Visit our Contact Page</Link>
          </p>
          <p>
            We will respond to privacy inquiries within 30 days.
          </p>
        </section>

        <div className="legal-footer-note">
          <p>
            By using Pryde Social, you acknowledge that you have read and understood this Privacy Policy and consent to the collection, use, and storage of your information as described.
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
          <Link to="/community">Community Guidelines</Link>
          <Link to="/safety">Safety & Reporting</Link>
          <Link to="/contact">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}

export default Privacy;
