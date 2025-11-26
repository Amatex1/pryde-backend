import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import './Legal.css';

function FAQ() {
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
        <h1>🌈 Pryde Social — FAQ</h1>
        <p className="legal-subtitle">Frequently Asked Questions</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>General Questions</h2>

          <div className="faq-item">
            <h3>What is Pryde Social?</h3>
            <p>
              Pryde Social is an 18+ LGBTQ+ community platform created as a hobby project to provide a safe, respectful space for connection, support, creativity, and conversation.
            </p>
          </div>

          <div className="faq-item">
            <h3>Who runs Pryde Social?</h3>
            <p>
              The platform is operated privately as a hobby by a single Australian individual. Pryde Social is not a registered company.
            </p>
          </div>

          <div className="faq-item">
            <h3>Is Pryde Social free to use?</h3>
            <p>
              Yes. Pryde Social is completely free with no paid features.
            </p>
          </div>

          <div className="faq-item">
            <h3>Why is the platform 18+ only?</h3>
            <p>
              To protect younger users and ensure safer community discussions, Pryde Social is strictly limited to adults aged 18 and over.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>Accounts & Profiles</h2>

          <div className="faq-item">
            <h3>How do I create an account?</h3>
            <p>
              You can sign up using a valid email and password. You must confirm that you are 18 or older.
            </p>
          </div>

          <div className="faq-item">
            <h3>What profile information can I include?</h3>
            <p>You can add your:</p>
            <ul>
              <li>Full name</li>
              <li>Display name</li>
              <li>Nickname</li>
              <li>Pronouns</li>
              <li>Gender</li>
              <li>Sexual orientation</li>
              <li>Relationship status</li>
              <li>Bio</li>
              <li>Location (city/town only)</li>
              <li>Website</li>
              <li>Social links (Instagram, Twitter, TikTok, YouTube, Snapchat, Discord)</li>
              <li>Interests</li>
              <li>Safety/communication preferences</li>
              <li>Accessibility preferences</li>
              <li>Profile photo & cover photo</li>
              <li>Custom badges</li>
            </ul>
          </div>

          <div className="faq-item">
            <h3>How do I change or delete information on my profile?</h3>
            <p>
              Click the <strong>Edit Profile</strong> button on your profile page (located in the top right corner under your cover photo).
            </p>
          </div>

          <div className="faq-item">
            <h3>Can I hide parts of my profile?</h3>
            <p>
              Yes. In the Edit Profile modal, you can hide age, pronouns, gender, orientation, and city/town from other users using the visibility toggles.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>Posts, Comments & Messages</h2>

          <div className="faq-item">
            <h3>What can I post on Pryde Social?</h3>
            <p>
              You can post text, images, videos, and GIFs, as long as they follow our <Link to="/community-guidelines" className="legal-link">Community Guidelines</Link> and <Link to="/acceptable-use" className="legal-link">Acceptable Use Policy</Link>.
            </p>
          </div>

          <div className="faq-item">
            <h3>Can I control who sees my posts?</h3>
            <p>
              Yes! When creating a post, you can set the privacy to:
            </p>
            <ul>
              <li><strong>Public</strong> - Everyone can see</li>
              <li><strong>Friends</strong> - Only your friends can see</li>
              <li><strong>Private</strong> - Only you can see</li>
              <li><strong>Custom</strong> - Choose specific people who can see it or hide it from certain people</li>
            </ul>
          </div>

          <div className="faq-item">
            <h3>Can I share someone else's post?</h3>
            <p>
              Yes! Click the <strong>Share</strong> button on any post. You can add your own comment when sharing, and the original author will be credited.
            </p>
          </div>

          <div className="faq-item">
            <h3>Can I bookmark posts to read later?</h3>
            <p>
              Yes! Click the bookmark icon on any post. Access your saved posts from the dropdown menu in the navbar.
            </p>
          </div>

          <div className="faq-item">
            <h3>Can I reply to comments?</h3>
            <p>
              Yes! Click the <strong>💬 Reply</strong> button on any comment or reply to create threaded conversations.
            </p>
          </div>

          <div className="faq-item">
            <h3>Can I edit or delete my comments?</h3>
            <p>
              Yes! Click the <strong>✏️ Edit</strong> or <strong>🗑️ Delete</strong> button on your own comments and replies.
            </p>
          </div>

          <div className="faq-item">
            <h3>Can I message other users?</h3>
            <p>
              Yes. You can send one-on-one or group messages. Click the <strong>Messages</strong> button in the navbar or click on a friend in your friends list to start chatting.
            </p>
          </div>

          <div className="faq-item">
            <h3>Why can't I message someone?</h3>
            <p>They may have:</p>
            <ul>
              <li>"Friends only" messaging enabled</li>
              <li>"Ask before DM" turned on</li>
              <li>Blocked you</li>
              <li>Disabled DMs entirely</li>
            </ul>
          </div>

          <div className="faq-item">
            <h3>Do messages have sound notifications?</h3>
            <p>
              Yes! You'll hear a notification sound when you receive new messages while using the platform.
            </p>
          </div>

          <div className="faq-item">
            <h3>Can I reply to specific messages?</h3>
            <p>
              Yes! Click the <strong>💬 Reply</strong> button on any message to reply directly to it. The original message will be shown above your reply.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>Safety & Reporting</h2>

          <div className="faq-item">
            <h3>How do I block or report someone?</h3>
            <p>
              Use the <strong>Block</strong> or <strong>Report</strong> option on their profile or the specific post/comment/message.
            </p>
          </div>

          <div className="faq-item">
            <h3>What happens when I report content or a user?</h3>
            <p>Reports are reviewed and actions may include:</p>
            <ul>
              <li>Warning</li>
              <li>Content removal</li>
              <li>Temporary suspension</li>
              <li>Permanent ban</li>
            </ul>
          </div>

          <div className="faq-item">
            <h3>Is Pryde Social a crisis or emergency service?</h3>
            <p>
              <strong>No.</strong> Pryde Social cannot provide emergency help. If you are in immediate danger, contact your local emergency services.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>Legal & Privacy</h2>

          <div className="faq-item">
            <h3>How does Pryde Social handle my data?</h3>
            <p>
              Your personal data is stored securely and never sold to advertisers. See our <Link to="/privacy" className="legal-link">Privacy Policy</Link> for full details.
            </p>
          </div>

          <div className="faq-item">
            <h3>How do I delete my account?</h3>
            <p>
              Go to <strong>Settings → Account Management</strong> and choose <strong>Delete Account</strong>. You can also request deletion by emailing:
            </p>
            <div className="contact-info">
              <p><strong>📧</strong> <span className="contact-email">prydeapp-team@outlook.com</span></p>
            </div>
          </div>

          <div className="faq-item">
            <h3>What happens when my account is deleted?</h3>
            <p>
              Your profile and posts are removed. Some technical records (like log timestamps) may remain for security purposes.
            </p>
          </div>

          <div className="faq-item">
            <h3>How do I download my data?</h3>
            <p>
              Go to <strong>Settings → Account Management → Download Data</strong>. You'll receive a JSON file with all your profile info, posts, messages, and friends.
            </p>
          </div>

          <div className="faq-item">
            <h3>How do I file a copyright complaint (DMCA)?</h3>
            <p>
              Follow the instructions in our <Link to="/dmca" className="legal-link">DMCA Policy</Link>.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>Moderation & Bans</h2>

          <div className="faq-item">
            <h3>Why was my post removed?</h3>
            <p>
              It may have violated the <Link to="/community-guidelines" className="legal-link">Community Guidelines</Link> or <Link to="/acceptable-use" className="legal-link">Acceptable Use Policy</Link>.
            </p>
          </div>

          <div className="faq-item">
            <h3>Why was I suspended or banned?</h3>
            <p>
              Reasons may include harassment, hate speech, impersonation, illegal content, or repeated violations. A suspension notification is usually sent to your email.
            </p>
          </div>

          <div className="faq-item">
            <h3>Can I appeal a moderation decision?</h3>
            <p>
              Yes. Email a clear explanation to:
            </p>
            <div className="contact-info">
              <p><strong>📧</strong> <span className="contact-email">prydeapp-team@outlook.com</span></p>
            </div>
          </div>
        </section>

        <section className="legal-section">
          <h2>Technical Questions</h2>

          <div className="faq-item">
            <h3>Why isn't the site loading properly?</h3>
            <p>Try the following:</p>
            <ul>
              <li>Clear your browser cache</li>
              <li>Refresh the page</li>
              <li>Disable browser extensions</li>
              <li>Try a different device or browser</li>
            </ul>
          </div>

          <div className="faq-item">
            <h3>What if I find a bug?</h3>
            <p>
              Please report it so it can be fixed:
            </p>
            <div className="contact-info">
              <p><strong>📧</strong> <span className="contact-email">prydeapp-team@outlook.com</span></p>
            </div>
          </div>

          <div className="faq-item">
            <h3>How do I enable push notifications?</h3>
            <p>
              Go to <strong>Settings → Notifications → Test Push Notification</strong>. Your browser will ask for permission. Click "Allow".
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>Contact Information</h2>
          <p>
            If you need help with anything not covered here, contact:
          </p>
          <div className="contact-info">
            <p><strong>📧 Email:</strong> <span className="contact-email">prydeapp-team@outlook.com</span></p>
          </div>
        </section>

        <div className="legal-footer-note">
          <p>
            <strong>Still have questions?</strong> Email us at <span className="contact-email">prydeapp-team@outlook.com</span>
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

export default FAQ;

