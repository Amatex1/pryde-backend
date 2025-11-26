import { Link } from 'react-router-dom';
import './Legal.css';

function FAQ() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <h1>Frequently Asked Questions (FAQ)</h1>
        <p className="legal-subtitle">Quick Answers to Common Questions</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>1. Account & Login</h2>
          
          <div className="faq-item">
            <h3>How do I create an account?</h3>
            <p>Click "Sign Up" on the homepage, enter your email, create a password, and confirm you're 18+. You'll receive a verification email to activate your account.</p>
          </div>

          <div className="faq-item">
            <h3>I forgot my password. How do I reset it?</h3>
            <p>Click "Forgot Password?" on the login page, enter your email, and follow the reset link sent to your inbox. The link expires in 1 hour.</p>
          </div>

          <div className="faq-item">
            <h3>Can I change my username?</h3>
            <p>Yes! Go to Settings → Profile → Edit Display Name. Your username is unique and can be changed once every 30 days.</p>
          </div>

          <div className="faq-item">
            <h3>How do I delete my account?</h3>
            <p>Go to Settings → Account Management → Delete Account. This is permanent and cannot be undone. All your data will be deleted within 30 days.</p>
          </div>

          <div className="faq-item">
            <h3>Can I deactivate my account temporarily?</h3>
            <p>Yes! Go to Settings → Account Management → Deactivate Account. Your profile will be hidden, but you can reactivate by logging in again.</p>
          </div>
        </section>

        <section className="legal-section">
          <h2>2. Privacy & Safety</h2>
          
          <div className="faq-item">
            <h3>Who can see my posts?</h3>
            <p>By default, your friends can see your posts. You can adjust privacy settings in Settings → Privacy to make posts public or private.</p>
          </div>

          <div className="faq-item">
            <h3>How do I block someone?</h3>
            <p>Visit their profile → Click the three-dot menu (⋯) → Select "Block User". They won't be able to see your posts or contact you.</p>
          </div>

          <div className="faq-item">
            <h3>How do I report a post or user?</h3>
            <p>Click the three-dot menu (⋯) on any post or profile → Select "Report". Choose a reason and provide details. Our moderation team will review it within 24 hours.</p>
          </div>

          <div className="faq-item">
            <h3>Can I see who viewed my profile?</h3>
            <p>No, Pryde Social does not track profile views. Your privacy is important to us.</p>
          </div>

          <div className="faq-item">
            <h3>How do I download my data?</h3>
            <p>Go to Settings → Account Management → Download Data. You'll receive a JSON file with all your profile info, posts, messages, and friends.</p>
          </div>
        </section>

        <section className="legal-section">
          <h2>3. Posts & Content</h2>
          
          <div className="faq-item">
            <h3>What file types can I upload?</h3>
            <p>Images: JPG, PNG, GIF, WebP (max 10MB). Videos: MP4, WebM (max 50MB). Profile photos are automatically resized.</p>
          </div>

          <div className="faq-item">
            <h3>Can I edit or delete my posts?</h3>
            <p>Yes! Click the three-dot menu (⋯) on your post → Select "Edit" or "Delete". Edited posts show an "(edited)" label.</p>
          </div>

          <div className="faq-item">
            <h3>Why was my post removed?</h3>
            <p>Posts are removed if they violate our <Link to="/community" className="legal-link">Community Guidelines</Link>. Check your notifications for details or contact us at abuse@prydesocial.com.</p>
          </div>

          <div className="faq-item">
            <h3>Can I save posts for later?</h3>
            <p>Bookmarking feature is coming soon! For now, you can like posts to find them in your activity history.</p>
          </div>
        </section>

        <section className="legal-section">
          <h2>4. Messaging & Friends</h2>
          
          <div className="faq-item">
            <h3>How do I send a friend request?</h3>
            <p>Visit their profile → Click "Add Friend". They'll receive a notification and can accept or decline.</p>
          </div>

          <div className="faq-item">
            <h3>Can I message someone who isn't my friend?</h3>
            <p>Currently, you can only message friends. Privacy settings for messaging will be added soon.</p>
          </div>

          <div className="faq-item">
            <h3>How do I create a group chat?</h3>
            <p>Go to Messages → Click "New Group" → Select friends → Name your group → Click "Create". You can add up to 50 members.</p>
          </div>

          <div className="faq-item">
            <h3>Can I delete messages?</h3>
            <p>Yes! Hover over a message → Click the trash icon. Deleted messages are removed from your view but may remain visible to recipients.</p>
          </div>

          <div className="faq-item">
            <h3>What do the checkmarks mean?</h3>
            <p>One checkmark (✓) = Delivered. Two checkmarks (✓✓) = Read. Gray = Not delivered yet.</p>
          </div>
        </section>

        <section className="legal-section">
          <h2>5. Technical Issues</h2>
          
          <div className="faq-item">
            <h3>The site isn't loading. What should I do?</h3>
            <p>Try refreshing the page, clearing your browser cache, or using a different browser. If the issue persists, email support@prydesocial.com.</p>
          </div>

          <div className="faq-item">
            <h3>Why can't I upload images?</h3>
            <p>Check your file size (max 10MB for images, 50MB for videos) and format (JPG, PNG, GIF, WebP). If the issue continues, try a different browser.</p>
          </div>

          <div className="faq-item">
            <h3>How do I enable push notifications?</h3>
            <p>Go to Settings → Notifications → Enable Push Notifications. Your browser will ask for permission. Click "Allow".</p>
          </div>

          <div className="faq-item">
            <h3>Why am I not receiving notifications?</h3>
            <p>Check Settings → Notifications to ensure they're enabled. Also check your browser's notification permissions and email spam folder.</p>
          </div>
        </section>

        <section className="legal-section">
          <h2>6. Policies & Guidelines</h2>
          
          <div className="faq-item">
            <h3>Is Pryde Social free?</h3>
            <p>Yes! Pryde Social is completely free with no ads. We may introduce optional premium features in the future.</p>
          </div>

          <div className="faq-item">
            <h3>Do I have to be 18 to use Pryde Social?</h3>
            <p>Yes. Pryde Social is strictly for users 18 years of age and older. Accounts found to be under 18 will be immediately deleted.</p>
          </div>

          <div className="faq-item">
            <h3>What content is not allowed?</h3>
            <p>Prohibited content includes: hate speech, harassment, adult content, violence, illegal activity, spam, and impersonation. See our <Link to="/community" className="legal-link">Community Guidelines</Link> for details.</p>
          </div>

          <div className="faq-item">
            <h3>Can I appeal a suspension or ban?</h3>
            <p>Yes. Email abuse@prydesocial.com with your username and reason for appeal. We'll review your case within 5 business days.</p>
          </div>

          <div className="faq-item">
            <h3>Does Pryde Social sell my data?</h3>
            <p>No. We do NOT sell your personal data to third parties. See our <Link to="/privacy" className="legal-link">Privacy Policy</Link> for how we use your information.</p>
          </div>
        </section>

        <div className="legal-footer-note">
          <p>
            <strong>Still have questions?</strong> Visit our <Link to="/contact" className="legal-link">Contact</Link> page or email support@prydesocial.com.
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
          <Link to="/safety">Safety & Reporting</Link>
          <Link to="/contact">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}

export default FAQ;

