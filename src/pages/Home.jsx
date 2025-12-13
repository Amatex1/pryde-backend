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
              A Calm, Queer-Centred Social Platform Built by LGBTQ+ People, for LGBTQ+ People
            </h1>
            <p className="hero-subtitle">
              Where you can create, reflect, and connect without algorithms, virality, or pressure. Respectful allies welcome.
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
                  <a
                    href="#features"
                    className="btn-secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Explore Features
                  </a>
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

      {/* Mission Section */}
      <section className="philosophy-section" id="about">
        <div className="philosophy-content" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className="section-title">Built by Queer People, for Queer People</h2>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.8', color: 'var(--text-main)', marginBottom: '2rem' }}>
            Pryde Social was created by an LGBTQ+ developer who wanted a social platform that prioritises <strong>safety, privacy, and genuine connection</strong> over engagement metrics and viral growth.
          </p>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.8', color: 'var(--text-main)' }}>
            This is a space where you can be yourself without algorithms pushing you toward outrage, where your mental health matters more than your follower count, and where queer voices are centred — not debated.
          </p>
        </div>
      </section>

      {/* Quiet Mode + Slow Feed Section */}
      <section className="philosophy-section" id="features">
        <div className="philosophy-grid">
          <div className="philosophy-card">
            <div className="philosophy-icon">🍃</div>
            <h3>Quiet Mode</h3>
            <p>A soothing browsing experience with hidden metrics, softer colors, and reduced noise. Protect your mental health.</p>
          </div>
          <div className="philosophy-card">
            <div className="philosophy-icon">⏳</div>
            <h3>Slow Feed Philosophy</h3>
            <p>Chronological posts. No algorithms. No viral pressure. A calmer, more intentional social space.</p>
          </div>
          <div className="philosophy-card">
            <div className="philosophy-icon">🏳️‍🌈</div>
            <h3>Queer-Centred</h3>
            <p>Built for LGBTQ+ people first. Respectful allies welcome, but queer voices are prioritised.</p>
          </div>
        </div>
      </section>

      {/* Privacy & Safety Section */}
      <section className="privacy-section">
        <div className="privacy-content">
          <h2 className="section-title">Your Safety. Your Privacy. Your Control.</h2>
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
            <div className="creator-icon">💬</div>
            <h3>Comments & Reactions</h3>
            <p>Engage with posts through nested comments and 14 emoji reactions.</p>
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
          <div className="creator-card">
            <div className="creator-icon">🔖</div>
            <h3>Bookmarks & Sharing</h3>
            <p>Save posts for later and share content with your followers.</p>
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
          <h2 className="section-title">Connect & Chat</h2>
          <div className="messaging-grid">
            <div className="messaging-card">
              <div className="messaging-icon">💬</div>
              <h3>Direct Messages</h3>
              <p>1-on-1 real-time conversations with read receipts, reactions, attachments, and message editing.</p>
            </div>
            <div className="messaging-card">
              <div className="messaging-icon">🛋️</div>
              <h3>Lounge (Global Chat)</h3>
              <p>Join the community in our public chat room for casual conversations and making new friends.</p>
            </div>
          </div>
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
              <span>Sound notifications for new messages</span>
            </div>
            <div className="notification-item">
              <span className="notif-icon">💬</span>
              <span>Comment, reaction, share, mention alerts</span>
            </div>
            <div className="notification-item">
              <span className="notif-icon">📨</span>
              <span>Message & Lounge notifications</span>
            </div>
            <div className="notification-item">
              <span className="notif-icon">⚙️</span>
              <span>Customizable notification preferences</span>
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
          <h2 className="final-cta-title">Join a Queer-Centred Space Built for Connection, Not Clout</h2>
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

