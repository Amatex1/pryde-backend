import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import './Legal.css';

function Safety() {
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
        <Link to="/" className="legal-home-button">
          🏠 Home
        </Link>
        <h1>🌈 Pryde Social — Safety Center</h1>
        <p className="legal-subtitle">Last Updated: December 28, 2024</p>
      </div>

      <div className="legal-content">
        <div className="emergency-banner" style={{
          background: 'var(--soft-lavender)',
          border: '2px solid var(--pryde-purple)',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ color: 'var(--pryde-purple)', marginTop: 0 }}>⚠️ Important</h2>
          <p>
            <strong>Pryde Social is not an emergency service.</strong>
          </p>
          <p>
            If you are in immediate danger, contact local authorities:
          </p>
          <ul style={{ marginTop: '0.5rem' }}>
            <li><strong>Australia:</strong> 000 (Police, Ambulance, Fire)</li>
            <li><strong>US:</strong> 911</li>
            <li><strong>UK:</strong> 999</li>
            <li><strong>Other countries:</strong> See our <Link to="/helplines" className="legal-link">Global Helplines</Link> page</li>
          </ul>
        </div>

        <section className="legal-section">
          <h2>1. Staying Safe Online</h2>
          <ul>
            <li>Don't share personal information (address, phone number, financial details)</li>
            <li>Use strong, unique passwords</li>
            <li>Be cautious about meeting people in person</li>
            <li>Trust your instincts — if something feels wrong, it probably is</li>
            <li>Report suspicious behavior</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>2. LGBTQ+ Safety Tips</h2>
          <ul>
            <li>Control your privacy settings</li>
            <li>Only share what you're comfortable with</li>
            <li>Block users who make you uncomfortable</li>
            <li>Report hate speech or harassment immediately</li>
            <li>You are not obligated to disclose your identity to anyone</li>
          </ul>

          <div style={{
            background: 'rgba(255, 165, 0, 0.1)',
            border: '2px solid #ff8c00',
            borderRadius: '8px',
            padding: '1.5rem',
            marginTop: '1.5rem'
          }}>
            <h3 style={{ color: '#ff8c00', marginTop: 0 }}>⚠️ Safety in High-Risk Regions</h3>
            <p>
              <strong>If you are in a country where same-sex relationships are criminalised, please take extra precautions:</strong>
            </p>
            <ul style={{ marginTop: '0.5rem' }}>
              <li><strong>Do not use real names</strong> — Use a pseudonym or nickname</li>
              <li><strong>Do not use real photos</strong> — Avoid profile pictures that could identify you</li>
              <li><strong>Do not share identifying details</strong> — Avoid posting your location, workplace, school, or other personal information</li>
              <li><strong>Turn off online status and last seen</strong> — Go to Settings → Privacy to disable these features</li>
              <li><strong>Avoid enabling location</strong> unless it is safe to do so</li>
              <li><strong>Use a VPN</strong> if accessing the platform from a restricted region</li>
              <li><strong>Be cautious about who you connect with</strong> — Verify identities before sharing personal information</li>
            </ul>
            <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>
              Your safety is our priority. If you feel unsafe, please deactivate your account or contact us for assistance.
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>3. Crisis Support</h2>
          <p>
            <strong>If you're in crisis:</strong>
          </p>

          <h3>🇦🇺 Australia</h3>
          <ul>
            <li><strong>Lifeline:</strong> 13 11 14 (24/7 crisis support)</li>
            <li><strong>Beyond Blue:</strong> 1300 22 4636 (mental health support)</li>
            <li><strong>Suicide Call Back Service:</strong> 1300 659 467</li>
            <li><strong>Kids Helpline:</strong> 1800 55 1800 (ages 5-25)</li>
          </ul>

          <h3>🏳️‍🌈 LGBTQ+ Specific Resources (Australia)</h3>
          <ul>
            <li><strong>QLife:</strong> 1800 184 527 (LGBTQ+ peer support, 3pm-midnight daily)</li>
            <li><strong>QLife Webchat:</strong> <a href="https://qlife.org.au" target="_blank" rel="noopener noreferrer">qlife.org.au</a></li>
            <li><strong>Switchboard Victoria:</strong> 1800 184 527 (LGBTIQ+ support)</li>
            <li><strong>Transgender Victoria:</strong> (03) 9020 4675</li>
          </ul>

          <h3>🌍 International Crisis Support</h3>
          <ul>
            <li><strong>US:</strong> 988 (Suicide & Crisis Lifeline)</li>
            <li><strong>US:</strong> Text HOME to 741741 (Crisis Text Line)</li>
            <li><strong>UK:</strong> 116 123 (Samaritans)</li>
            <li><strong>Trevor Project (US LGBTQ+ youth):</strong> 1-866-488-7386</li>
            <li><strong>Trans Lifeline (US/Canada):</strong> 1-877-565-8860</li>
          </ul>

          <p style={{ marginTop: '1.5rem' }}>
            <strong>📋 For a comprehensive list of helplines worldwide, visit our <Link to="/helplines" className="legal-link">Global Helplines</Link> page.</strong>
          </p>
        </section>

        <section className="legal-section">
          <h2>4. How to Block</h2>
          <p>
            <strong>To block a user:</strong>
          </p>
          <ul>
            <li>Go to their profile</li>
            <li>Click the three-dot menu (⋯)</li>
            <li>Select "Block User"</li>
            <li>Confirm</li>
          </ul>
          <p>
            <strong>What blocking does:</strong>
          </p>
          <ul>
            <li>They can't see your posts or profile</li>
            <li>They can't message you</li>
            <li>You won't see their content</li>
            <li>They won't be notified</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>5. How to Report</h2>
          <p>
            <strong>To report a post:</strong>
          </p>
          <ul>
            <li>Click the three-dot menu (⋯) on the post</li>
            <li>Select "Report Post"</li>
            <li>Choose the reason</li>
            <li>Submit</li>
          </ul>
          <p>
            <strong>To report a user:</strong>
          </p>
          <ul>
            <li>Go to their profile</li>
            <li>Click the three-dot menu (⋯)</li>
            <li>Select "Report User"</li>
            <li>Describe the issue</li>
          </ul>
          <p>
            <strong>To report a message:</strong>
          </p>
          <ul>
            <li>Open the conversation</li>
            <li>Right-click or long-press the message</li>
            <li>Select "Report Message"</li>
            <li>Provide details</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>6. When We Act</h2>
          <p>
            <strong>We review all reports and may:</strong>
          </p>
          <ul>
            <li>Remove violating content</li>
            <li>Issue warnings</li>
            <li>Suspend accounts</li>
            <li>Permanently ban users</li>
          </ul>
          <p>
            <strong>Severe violations (CSAM, threats, hate speech) result in immediate bans.</strong>
          </p>
        </section>

        <section className="legal-section">
          <h2>7. We Are Not Mandated Reporters</h2>
          <p>
            Pryde Social is a hobby-operated platform. We are not mandated reporters and do not automatically forward user issues to authorities.
          </p>
          <p>
            <strong>However:</strong> We may report severe violations (CSAM, credible threats, illegal activity) to law enforcement when necessary.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Contact</h2>
          <div className="contact-info">
            <p><strong>📧</strong> <span className="contact-email">prydeapp-team@outlook.com</span></p>
          </div>
        </section>

        <div className="legal-footer-note">
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

export default Safety;
