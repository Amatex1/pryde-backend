import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { isAuthenticated } from '../utils/auth';
import prydeLogo from '../assets/pryde-logo.png';
import Footer from '../components/Footer';
import './Home.css';

function Home() {
  const isAuth = isAuthenticated();

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
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-logo-container">
              <img src={prydeLogo} alt="Pryde Social Logo" className="hero-logo" />
            </div>
            <h1 className="hero-title">
              A Calm, Queer-First Social Platform Built for Introverts & Deep Thinkers
            </h1>
            <p className="hero-subtitle">
              Where LGBTQ+ people and supportive allies can create, reflect, and connect — peacefully.
            </p>
            <div className="hero-buttons">
              {isAuth ? (
                <>
                  <Link to="/feed" className="btn-primary">
                    Go to Feed
                  </Link>
                  <Link to="/discover" className="btn-secondary">
                    Explore Community Tags
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/register" className="btn-primary">
                    Join Pryde
                  </Link>
                  <Link to="#features" className="btn-secondary">
                    Explore Features
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

      {/* Quiet Mode + Slow Feed Section */}
      <section className="philosophy-section" id="features">
        <div className="philosophy-grid">
          <div className="philosophy-card">
            <div className="philosophy-icon">🍃</div>
            <h3>Quiet Mode</h3>
            <p>A soothing browsing experience with hidden metrics, softer colors, and reduced noise.</p>
          </div>
          <div className="philosophy-card">
            <div className="philosophy-icon">⏳</div>
            <h3>Slow Feed Philosophy</h3>
            <p>Chronological posts. No algorithms. No viral pressure. A calmer, more intentional social space.</p>
          </div>
        </div>
      </section>

      {/* Privacy & Safety Section */}
      <section className="privacy-section">
        <div className="privacy-content">
          <h2 className="section-title">Your Identity. Your Pace. Your Privacy.</h2>
          <div className="privacy-grid">
            <div className="privacy-item">
              <span className="privacy-icon">🔞</span>
              <span>18+ only platform</span>
            </div>
            <div className="privacy-item">
              <span className="privacy-icon">🏳️‍🌈</span>
              <span>LGBTQ+ safety guidance</span>
            </div>
            <div className="privacy-item">
              <span className="privacy-icon">👁️</span>
              <span>Hidden like counts & follower counts</span>
            </div>
            <div className="privacy-item">
              <span className="privacy-icon">🔐</span>
              <span>Private connections</span>
            </div>
            <div className="privacy-item">
              <span className="privacy-icon">💬</span>
              <span>Who-can-message controls</span>
            </div>
            <div className="privacy-item">
              <span className="privacy-icon">⚠️</span>
              <span>Content warnings</span>
            </div>
            <div className="privacy-item">
              <span className="privacy-icon">🔑</span>
              <span>2FA + passkeys</span>
            </div>
            <div className="privacy-item">
              <span className="privacy-icon">📱</span>
              <span>Session management</span>
            </div>
            <div className="privacy-item">
              <span className="privacy-icon">🚨</span>
              <span>Suspicious login alerts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Creator Expression Section */}
      <section className="creator-section">
        <h2 className="section-title">Express Yourself, Your Way</h2>
        <div className="creator-grid">
          <div className="creator-card">
            <div className="creator-icon">📝</div>
            <h3>Posts</h3>
            <p>Share text, images, videos, and GIFs with content warnings and visibility controls.</p>
          </div>
          <div className="creator-card">
            <div className="creator-icon">📔</div>
            <h3>Journals</h3>
            <p>Private or public long-form reflections with mood tracking.</p>
          </div>
          <div className="creator-card">
            <div className="creator-icon">✍️</div>
            <h3>Longform Writing</h3>
            <p>Essays and deep thought pieces with clean reading mode.</p>
          </div>
          <div className="creator-card">
            <div className="creator-icon">📸</div>
            <h3>Photo Essays</h3>
            <p>Curated visual storytelling for creators.</p>
          </div>
        </div>
      </section>

      {/* Community Tags Section */}
      <section className="tags-section">
        <div className="tags-content">
          <h2 className="section-title">Find Your Community</h2>
          <p className="tags-subtitle">
            Explore curated Community Tags made for queer life, creativity, self-care, and deep reflection.
          </p>
          <div className="tags-grid">
            <div className="tag-badge">🛋️ Introverts Lounge</div>
            <div className="tag-badge">🏳️‍🌈 Queer Life</div>
            <div className="tag-badge">🧠 Mental Health Corner</div>
            <div className="tag-badge">💭 Deep Thoughts</div>
            <div className="tag-badge">✍️ Writing & Poetry</div>
            <div className="tag-badge">🎨 Creative Hub</div>
            <div className="tag-badge">📷 Photography</div>
            <div className="tag-badge">🌿 Self-Care</div>
            <div className="tag-badge">🎵 Music & Audio</div>
          </div>
          {isAuth ? (
            <Link to="/discover" className="btn-tags">
              Browse All Tags
            </Link>
          ) : (
            <Link to="/register" className="btn-tags">
              Browse All Tags
            </Link>
          )}
        </div>
      </section>

      {/* Messaging Section */}
      <section className="messaging-section">
        <div className="messaging-content">
          <h2 className="section-title">Private, Comfortable Messaging</h2>
          <p className="messaging-description">
            1-on-1 real-time conversations with read receipts, reactions, attachments, and message editing.
            All messaging now happens in the dedicated Messages page for clarity and calm.
          </p>
          {isAuth ? (
            <Link to="/messages" className="btn-messaging">
              Open Messages
            </Link>
          ) : (
            <Link to="/register" className="btn-messaging">
              Join to Message
            </Link>
          )}
        </div>
      </section>

      {/* Notifications Section */}
      <section className="notifications-section">
        <div className="notifications-content">
          <h2 className="section-title">Stay Informed — Calmly</h2>
          <div className="notifications-list">
            <div className="notification-item">
              <span className="notif-icon">⚡</span>
              <span>Real-time updates via Socket.IO</span>
            </div>
            <div className="notification-item">
              <span className="notif-icon">🔔</span>
              <span>Push notifications</span>
            </div>
            <div className="notification-item">
              <span className="notif-icon">💬</span>
              <span>Comment, like, share, mention alerts</span>
            </div>
            <div className="notification-item">
              <span className="notif-icon">📨</span>
              <span>Message notifications</span>
            </div>
            <div className="notification-item">
              <span className="notif-icon">⚙️</span>
              <span>Notification preferences</span>
            </div>
          </div>
        </div>
      </section>

      {/* Themes Section */}
      <section className="themes-section">
        <h2 className="section-title">Choose Your Vibe</h2>
        <div className="themes-grid">
          <div className="theme-card theme-light">
            <div className="theme-preview"></div>
            <h3>Light Mode</h3>
            <p>Clean and bright</p>
          </div>
          <div className="theme-card theme-dark">
            <div className="theme-preview"></div>
            <h3>Dark Mode</h3>
            <p>Deep navy-purple</p>
          </div>
          <div className="theme-card theme-quiet">
            <div className="theme-preview"></div>
            <h3>Quiet Mode</h3>
            <p>Midnight violet calm</p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="final-cta-section">
        <div className="final-cta-content">
          <h2 className="final-cta-title">Join a Social Space Built for You</h2>
          <div className="final-cta-buttons">
            {isAuth ? (
              <>
                <Link to="/feed" className="btn-cta-primary">
                  Go to Feed
                </Link>
                <Link to="/discover" className="btn-cta-secondary">
                  Explore Community Tags
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="btn-cta-primary">
                  Create Your Profile
                </Link>
                <Link to="/register" className="btn-cta-secondary">
                  Explore Community Tags
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default Home;

