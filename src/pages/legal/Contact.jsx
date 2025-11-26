import { Link } from 'react-router-dom';
import './Legal.css';

function Contact() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <h1>🌈 Pryde Social — Contact</h1>
        <p className="legal-subtitle">Last Updated: January 1, 2025</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>General Support</h2>
          <div className="contact-info">
            <p><strong>📧</strong> <span className="contact-email">prydeapp-team@outlook.com</span></p>
          </div>
          <p>
            For general questions, account issues, or platform feedback.
          </p>
        </section>

        <section className="legal-section">
          <h2>Abuse or Harassment Reports</h2>
          <div className="contact-info">
            <p><strong>📧</strong> <span className="contact-email">prydeapp-team@outlook.com</span></p>
          </div>
          <p>
            Report violations of our <Link to="/community-guidelines" className="legal-link">Community Guidelines</Link>.
          </p>
        </section>

        <section className="legal-section">
          <h2>DMCA Requests</h2>
          <div className="contact-info">
            <p><strong>📧</strong> <span className="contact-email">prydeapp-team@outlook.com</span></p>
          </div>
          <p>
            Submit copyright takedown requests. See our <Link to="/dmca" className="legal-link">DMCA Policy</Link> for details.
          </p>
        </section>

        <section className="legal-section">
          <h2>Response Time</h2>
          <p>
            <strong>1–3 business days</strong> for most inquiries.
          </p>
          <p>
            Urgent safety issues are prioritized and reviewed immediately.
          </p>
        </section>

        <section className="legal-section">
          <h2>Useful Links</h2>
          <ul>
            <li><Link to="/terms" className="legal-link">Terms of Service</Link></li>
            <li><Link to="/privacy" className="legal-link">Privacy Policy</Link></li>
            <li><Link to="/safety" className="legal-link">Safety Center</Link></li>
            <li><Link to="/community-guidelines" className="legal-link">Community Guidelines</Link></li>
            <li><Link to="/acceptable-use" className="legal-link">Acceptable Use Policy</Link></li>
            <li><Link to="/dmca" className="legal-link">DMCA Policy</Link></li>
            <li><Link to="/cookie-policy" className="legal-link">Cookie Policy</Link></li>
          </ul>
        </section>

        <div className="legal-footer-note">
          <p className="last-updated">
            Last Updated: January 1, 2025
          </p>
        </div>
      </div>

      <div className="legal-nav-footer">
        <Link to="/" className="back-link">← Back to Home</Link>
      </div>
    </div>
  );
}

export default Contact;
