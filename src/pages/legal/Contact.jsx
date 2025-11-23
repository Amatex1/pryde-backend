import { Link } from 'react-router-dom';
import { useState } from 'react';
import './Legal.css';

function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // In a real implementation, this would send to the backend
    console.log('Contact form submitted:', formData);
    setSubmitted(true);
    setTimeout(() => {
      setFormData({ name: '', email: '', subject: '', category: '', message: '' });
      setSubmitted(false);
    }, 4000);
  };

  return (
    <div className="legal-page">
      <div className="legal-header contact-header">
        <h1>Contact Us</h1>
        <p className="legal-subtitle">We're Here to Help</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>Get in Touch</h2>
          <p>
            Have questions, feedback, or need support? The Pryde Social team is here to help. Choose the best way to reach us below.
          </p>
        </section>

        <section className="legal-section">
          <h2>Contact Form</h2>
          <div className="contact-form-container">
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Your Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="category">Inquiry Category</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Select Category --</option>
                  <option value="general">General Question</option>
                  <option value="support">Technical Support</option>
                  <option value="account">Account Issue</option>
                  <option value="safety">Safety or Abuse Report</option>
                  <option value="privacy">Privacy Concern</option>
                  <option value="legal">Legal Inquiry</option>
                  <option value="partnership">Partnership or Business</option>
                  <option value="feedback">Feedback or Suggestion</option>
                  <option value="press">Press or Media Inquiry</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  placeholder="Brief description of your inquiry"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Please provide details about your inquiry..."
                  rows="8"
                  required
                />
              </div>

              <button type="submit" className="submit-contact-btn">
                Send Message
              </button>

              {submitted && (
                <div className="contact-success">
                  ✓ Message sent successfully! We'll respond within 1-2 business days.
                </div>
              )}
            </form>

            <div className="contact-note">
              <p>
                <strong>Expected Response Time:</strong>
              </p>
              <ul>
                <li><strong>General Inquiries:</strong> 1-2 business days</li>
                <li><strong>Technical Support:</strong> 24-48 hours</li>
                <li><strong>Safety Reports:</strong> 24 hours (priority)</li>
                <li><strong>Legal Matters:</strong> 3-5 business days</li>
              </ul>
              <p className="urgent-note">
                <strong>Urgent Safety Issues:</strong> Use our <Link to="/safety" className="legal-link">Safety & Reporting</Link> page for immediate attention.
              </p>
            </div>
          </div>
        </section>

        <section className="legal-section">
          <h2>Direct Email Contacts</h2>
          <p>
            Prefer to email us directly? Use these addresses for specific departments:
          </p>

          <div className="contact-methods">
            <div className="contact-method">
              <h3>📧 General Support</h3>
              <p className="contact-email">support@prydesocial.com</p>
              <p>Account help, technical issues, general questions</p>
            </div>

            <div className="contact-method">
              <h3>🛡️ Safety & Trust</h3>
              <p className="contact-email">safety@prydesocial.com</p>
              <p>Abuse reports, safety concerns, policy violations</p>
            </div>

            <div className="contact-method">
              <h3>🔒 Privacy</h3>
              <p className="contact-email">privacy@prydesocial.com</p>
              <p>Data requests, privacy inquiries, GDPR/CCPA compliance</p>
            </div>

            <div className="contact-method">
              <h3>⚖️ Legal</h3>
              <p className="contact-email">legal@prydesocial.com</p>
              <p>Terms questions, DMCA notices, law enforcement requests</p>
            </div>

            <div className="contact-method">
              <h3>💼 Business & Partnerships</h3>
              <p className="contact-email">partnerships@prydesocial.com</p>
              <p>Business inquiries, collaborations, sponsorships</p>
            </div>

            <div className="contact-method">
              <h3>📰 Press & Media</h3>
              <p className="contact-email">press@prydesocial.com</p>
              <p>Media inquiries, press releases, interview requests</p>
            </div>

            <div className="contact-method">
              <h3>💡 Feedback</h3>
              <p className="contact-email">feedback@prydesocial.com</p>
              <p>Feature suggestions, bug reports, product feedback</p>
            </div>

            <div className="contact-method">
              <h3>👨‍💼 Careers</h3>
              <p className="contact-email">careers@prydesocial.com</p>
              <p>Job inquiries, internships, open positions</p>
            </div>
          </div>
        </section>

        <section className="legal-section">
          <h2>Frequently Asked Questions</h2>
          
          <div className="faq-item">
            <h3>How do I reset my password?</h3>
            <p>Visit the login page and click "Forgot Password?" Enter your email and follow the instructions.</p>
          </div>

          <div className="faq-item">
            <h3>How do I delete my account?</h3>
            <p>Go to Settings → Account → Delete Account. Note: This is permanent and cannot be undone.</p>
          </div>

          <div className="faq-item">
            <h3>Why was my post removed?</h3>
            <p>Posts are removed if they violate our <Link to="/community" className="legal-link">Community Guidelines</Link>. Check your notifications for details.</p>
          </div>

          <div className="faq-item">
            <h3>How do I report a bug?</h3>
            <p>Email <strong>feedback@prydesocial.com</strong> with a description, screenshots, and your device/browser info.</p>
          </div>

          <div className="faq-item">
            <h3>Can I get a refund for a subscription?</h3>
            <p>Pryde Social is currently free. If we introduce paid features, refund policies will be outlined in Terms of Service.</p>
          </div>

          <div className="faq-item">
            <h3>How do I verify my account?</h3>
            <p>We don't currently offer verification badges. Stay tuned for future updates!</p>
          </div>

          <div className="faq-item">
            <h3>Who can see my posts?</h3>
            <p>By default, your friends can see your posts. Adjust privacy settings in Settings → Privacy.</p>
          </div>

          <div className="faq-item">
            <h3>How do I block someone?</h3>
            <p>Visit their profile → Three-dot menu (⋯) → Block User. They won't be able to contact you or see your posts.</p>
          </div>

          <div className="faq-item">
            <h3>How do I request my data?</h3>
            <p>Email <strong>privacy@prydesocial.com</strong> with your username and email address. We'll send your data within 30 days.</p>
          </div>

          <div className="faq-item">
            <h3>How do I report copyright infringement?</h3>
            <p>Submit a DMCA notice to <strong>legal@prydesocial.com</strong> with the URL, proof of ownership, and your contact info.</p>
          </div>
        </section>

        <section className="legal-section">
          <h2>Mailing Address</h2>
          <p>
            For formal correspondence, legal notices, or official documents, mail us at:
          </p>
          <div className="mailing-address">
            <p>
              <strong>Pryde Social</strong><br />
              Attn: Legal Department<br />
              123 Social Network Lane<br />
              San Francisco, CA 94102<br />
              United States
            </p>
          </div>
          <p className="address-note">
            <strong>Note:</strong> Mailing responses may take 2-4 weeks. For faster assistance, use email or the contact form above.
          </p>
        </section>

        <section className="legal-section">
          <h2>Social Media</h2>
          <p>
            Stay connected with Pryde Social on social media (coming soon):
          </p>
          <div className="social-links">
            <p>🐦 <strong>Twitter:</strong> @PrydeSocial</p>
            <p>📘 <strong>Facebook:</strong> /PrydeSocial</p>
            <p>📷 <strong>Instagram:</strong> @PrydeSocial</p>
            <p>💼 <strong>LinkedIn:</strong> /company/pryde-social</p>
          </div>
          <p className="social-note">
            <em>Note: For support inquiries, please use email or the contact form rather than social media DMs.</em>
          </p>
        </section>

        <section className="legal-section">
          <h2>Feedback & Suggestions</h2>
          <p>
            We love hearing from our community! If you have ideas for new features, improvements, or just want to share your experience, let us know:
          </p>
          <ul>
            <li>Email: <strong>feedback@prydesocial.com</strong></li>
            <li>Use the contact form above (select "Feedback or Suggestion")</li>
            <li>Vote on feature requests in our upcoming Community Forum</li>
          </ul>
          <p>
            Your feedback helps us build a better Pryde Social for everyone!
          </p>
        </section>

        <div className="legal-footer-note">
          <p>
            Thank you for being part of the Pryde Social community. We're here to help and look forward to hearing from you!
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
        </div>
      </div>
    </div>
  );
}

export default Contact;
