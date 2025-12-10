import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './CookieBanner.css';

function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already acknowledged the banner
    const acknowledged = localStorage.getItem('cookieBannerAcknowledged');
    
    if (!acknowledged) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcknowledge = () => {
    localStorage.setItem('cookieBannerAcknowledged', 'true');
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="cookie-banner">
      <div className="cookie-banner-content">
        <p className="cookie-banner-text">
          🍪 We only use essential cookies for security and functionality. Pryde Social does not use tracking, analytics, or advertising cookies.
        </p>
        <div className="cookie-banner-actions">
          <Link to="/cookie-policy" className="cookie-learn-more">
            Learn More
          </Link>
          <button onClick={handleAcknowledge} className="cookie-acknowledge-btn">
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}

export default CookieBanner;

