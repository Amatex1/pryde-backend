import { Link } from 'react-router-dom';
import prydeLogo from '../assets/pryde-logo.png';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        {/* Site Name and Copyright */}
        <div className="footer-branding">
          <picture>
            <source srcSet="/icon-192.webp" type="image/webp" />
            <img
              src="/icon-192.png"
              alt="Pryde Social Logo"
              className="footer-logo-img"
              width="50"
              height="50"
              loading="lazy"
            />
          </picture>
          <h3 className="footer-logo">Pryde Social</h3>
          <p className="footer-copyright">
            © {currentYear} Pryde Social. All rights reserved.
          </p>
        </div>

        {/* Legal Links */}
        <div className="footer-links-container">
          <Link to="/terms">Terms of Service</Link>
          <span className="separator">•</span>
          <Link to="/privacy">Privacy Policy</Link>
          <span className="separator">•</span>
          <Link to="/security">Security</Link>
          <span className="separator">•</span>
          <Link to="/community">Community Guidelines</Link>
          <span className="separator">•</span>
          <Link to="/acceptable-use">Acceptable Use</Link>
          <span className="separator">•</span>
          <Link to="/safety">Safety Center</Link>
          <span className="separator">•</span>
          <Link to="/cookie-policy">Cookie Policy</Link>
          <span className="separator">•</span>
          <Link to="/dmca">DMCA</Link>
          <span className="separator">•</span>
          <Link to="/faq">FAQ</Link>
          <span className="separator">•</span>
          <Link to="/contact">Contact</Link>
        </div>
      </div>

      {/* Age Notice */}
      <div className="footer-notice">
        <p>Pryde Social is for users 18+ only. By using this platform, you confirm you are 18 years of age or older.</p>
      </div>
    </footer>
  );
}

export default Footer;
