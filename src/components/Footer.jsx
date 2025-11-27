import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3 className="footer-logo">Pryde Social</h3>
          <p className="footer-tagline">Connect. Share. Thrive.</p>
          <p className="footer-copyright">
            © {currentYear} Pryde Social. All rights reserved.
          </p>
        </div>

        <div className="footer-section">
          <h4>Legal</h4>
          <ul className="footer-links">
            <li><Link to="/terms">Terms of Service</Link></li>
            <li><Link to="/privacy">Privacy Policy</Link></li>
            <li><Link to="/security">Security</Link></li>
            <li><Link to="/community">Community Guidelines</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Support</h4>
          <ul className="footer-links">
            <li><Link to="/safety">Safety & Reporting</Link></li>
            <li><Link to="/helplines">Crisis Helplines</Link></li>
            <li><Link to="/contact">Contact Us</Link></li>
            <li><Link to="/faq">FAQ</Link></li>
            <li><Link to="/dmca">DMCA</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Community</h4>
          <ul className="footer-links">
            <li><Link to="/feed">Feed</Link></li>
            <li><Link to="/friends">Find Friends</Link></li>
            <li><Link to="/messages">Messages</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Follow Us</h4>
          <ul className="footer-links">
            <li><a href="https://twitter.com/prydesocial" target="_blank" rel="noopener noreferrer">Twitter</a></li>
            <li><a href="https://facebook.com/prydesocial" target="_blank" rel="noopener noreferrer">Facebook</a></li>
            <li><a href="https://instagram.com/prydesocial" target="_blank" rel="noopener noreferrer">Instagram</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-notice">
          Pryde Social is for users 18+ only. By using this platform, you confirm you are 18 years of age or older.
        </p>
        <div className="footer-quick-links">
          <Link to="/terms">Terms</Link>
          <span>•</span>
          <Link to="/privacy">Privacy</Link>
          <span>•</span>
          <Link to="/security">Security</Link>
          <span>•</span>
          <Link to="/community">Guidelines</Link>
          <span>•</span>
          <Link to="/safety">Safety</Link>
          <span>•</span>
          <Link to="/faq">FAQ</Link>
          <span>•</span>
          <Link to="/contact">Contact</Link>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
