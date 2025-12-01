import { Link } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';
import './Home.css';

function Home() {
  const isAuth = isAuthenticated();

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Welcome to <span className="brand-gradient">Pryde Social</span>
            </h1>
            <p className="hero-subtitle">
              Connect with friends, share your moments, and build meaningful relationships in a safe and inclusive community.
            </p>
            <div className="hero-buttons">
              {isAuth ? (
                <Link to="/feed" className="btn-primary">
                  Go to Feed
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn-primary">
                    Get Started
                  </Link>
                  <Link to="/login" className="btn-secondary">
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="hero-image">
            <div className="hero-graphic">
              <div className="graphic-circle circle-1"></div>
              <div className="graphic-circle circle-2"></div>
              <div className="graphic-circle circle-3"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title">Why Choose Pryde Social?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>Real-time Messaging</h3>
            <p>Chat with friends instantly with our lightning-fast messaging system. Create group chats and stay connected.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <h3>Build Your Network</h3>
            <p>Connect with friends, send requests, and grow your social circle in a safe and welcoming environment.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>Share Your Story</h3>
            <p>Post updates, photos, and thoughts. Like, comment, and engage with your community's content.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎨</div>
            <h3>Personalize Your Profile</h3>
            <p>Customize your profile with photos, bio, and social links. Make it uniquely yours.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Privacy First</h3>
            <p>Your data is secure. Control who sees your content and manage your privacy settings.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🌈</div>
            <h3>Inclusive Community</h3>
            <p>A safe space for everyone. We celebrate diversity and promote respect and kindness.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2 className="cta-title">Ready to Join?</h2>
          <p className="cta-subtitle">Start connecting with the Pryde Social community</p>
          {!isAuth && (
            <Link to="/register" className="btn-cta">
              Create Your Account
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3 className="brand-gradient">Pryde Social</h3>
            <p>Building connections, one post at a time.</p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Legal</h4>
              <Link to="/terms">Terms of Service</Link>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/community">Community Guidelines</Link>
              <Link to="/safety">Safety Center</Link>
            </div>
            <div className="footer-column">
              <h4>Support</h4>
              <Link to="/contact">Contact Us</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024 Pryde Social. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default Home;

