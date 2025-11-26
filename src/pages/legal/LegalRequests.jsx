import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import './Legal.css';

function LegalRequests() {
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
        <h1>Legal Requests & Law Enforcement</h1>
        <p className="legal-subtitle">Information for Law Enforcement and Legal Authorities</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h2>1. Overview</h2>
          <p>
            Pryde Social respects user privacy and complies with applicable laws. This page provides guidance for law enforcement agencies, government authorities, and legal representatives seeking user information or requesting content removal.
          </p>
          <p>
            <strong>Important:</strong> Pryde Social is NOT a mandated reporter. We are a technology platform, not a social services agency. However, we cooperate with valid legal requests and may voluntarily report content that poses imminent danger or involves serious crimes.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Types of Legal Requests</h2>
          <p>
            We respond to the following types of legal requests:
          </p>
          <ul>
            <li><strong>Subpoenas:</strong> Court-issued subpoenas for user data in civil or criminal cases</li>
            <li><strong>Search Warrants:</strong> Valid search warrants issued by a court of competent jurisdiction</li>
            <li><strong>Court Orders:</strong> Orders from a judge or magistrate requiring disclosure of information</li>
            <li><strong>Emergency Requests:</strong> Requests involving imminent danger of death or serious physical injury</li>
            <li><strong>Preservation Requests:</strong> Requests to preserve user data pending formal legal process</li>
            <li><strong>DMCA Takedown Notices:</strong> Copyright infringement claims (see our <Link to="/dmca" className="legal-link">DMCA Policy</Link>)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. How to Submit a Legal Request</h2>
          <p>
            <strong>Email:</strong> legal@prydesocial.com<br />
            <strong>Subject Line:</strong> Law Enforcement Request - [Case Number]
          </p>
          <p>
            <strong>Required Information:</strong>
          </p>
          <ul>
            <li>Your name, title, agency, and contact information</li>
            <li>Case number or reference number</li>
            <li>Specific user(s) or content being requested (username, profile URL, post URL)</li>
            <li>Legal basis for the request (subpoena, warrant, court order)</li>
            <li>Scope of information requested (profile data, messages, IP logs, etc.)</li>
            <li>Deadline for response (if applicable)</li>
            <li>Attached legal documents (PDF format)</li>
          </ul>
          <p>
            <strong>Mailing Address for Formal Service:</strong>
          </p>
          <div className="mailing-address">
            <p>
              <strong>Pryde Social</strong><br />
              Attn: Legal Department - Law Enforcement Requests<br />
              123 Social Network Lane<br />
              San Francisco, CA 94102<br />
              United States
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>4. Emergency Requests</h2>
          <p>
            If you believe there is an <strong>imminent threat of death or serious physical injury</strong>, we will expedite your request.
          </p>
          <p>
            <strong>Emergency Contact:</strong> legal@prydesocial.com (Subject: EMERGENCY REQUEST)
          </p>
          <p>
            <strong>What Qualifies as an Emergency:</strong>
          </p>
          <ul>
            <li>Credible suicide threats or self-harm</li>
            <li>Kidnapping or missing persons cases</li>
            <li>Imminent threats of violence (school shootings, terrorist attacks)</li>
            <li>Child exploitation or trafficking</li>
            <li>Active criminal investigations involving immediate danger</li>
          </ul>
          <p>
            <strong>Response Time:</strong> We aim to respond to emergency requests within 1-4 hours during business hours (9 AM - 5 PM PST, Monday-Friday). For after-hours emergencies, we will respond as soon as possible.
          </p>
          <p>
            <strong>Note:</strong> Emergency requests must still include sufficient information to identify the user and explain the emergency. We may request follow-up documentation.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Data We Can Provide</h2>
          <p>
            Depending on the legal basis and scope of the request, we may provide:
          </p>
          <ul>
            <li><strong>Basic Account Information:</strong> Username, email address, display name, account creation date, last login date</li>
            <li><strong>Profile Information:</strong> Bio, location, profile photo, cover photo, website links</li>
            <li><strong>Content:</strong> Posts, comments, messages, uploaded media (images, videos)</li>
            <li><strong>Activity Logs:</strong> Login timestamps, IP addresses, device information</li>
            <li><strong>Friend Connections:</strong> Friend list, friend requests, blocked users</li>
            <li><strong>Reports & Blocks:</strong> Reports filed by or against the user, users they've blocked</li>
            <li><strong>Moderation History:</strong> Warnings, suspensions, bans, and reasons</li>
          </ul>
          <p>
            <strong>What We Cannot Provide:</strong>
          </p>
          <ul>
            <li>Real-time location tracking (we do not collect GPS data)</li>
            <li>Deleted content (unless preserved via preservation request)</li>
            <li>Passwords (stored as one-way encrypted hashes)</li>
            <li>Data from third-party services (e.g., email providers)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>6. User Notification</h2>
          <p>
            Pryde Social's policy is to notify users when we receive a legal request for their information, unless:
          </p>
          <ul>
            <li>The request includes a valid court order prohibiting notification (gag order)</li>
            <li>We believe notification would create a risk of death or serious physical injury</li>
            <li>The request involves child exploitation or trafficking</li>
            <li>Notification would compromise an ongoing investigation (as specified in the request)</li>
          </ul>
          <p>
            Users will be notified via email and given an opportunity to challenge the request in court, unless prohibited by law.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Preservation Requests</h2>
          <p>
            Law enforcement can request that we preserve user data for up to 90 days while obtaining formal legal process (subpoena or warrant).
          </p>
          <p>
            <strong>How to Submit a Preservation Request:</strong>
          </p>
          <ul>
            <li>Email legal@prydesocial.com with "Preservation Request" in the subject line</li>
            <li>Include the username, profile URL, or specific content to preserve</li>
            <li>Explain the legal basis and pending investigation</li>
            <li>Provide your agency contact information</li>
          </ul>
          <p>
            We will preserve the data for 90 days. If we do not receive formal legal process within that time, the data may be deleted per our normal retention policies.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. International Requests</h2>
          <p>
            Pryde Social is based in the United States and subject to U.S. law. We respond to international legal requests through:
          </p>
          <ul>
            <li><strong>Mutual Legal Assistance Treaties (MLATs):</strong> Requests from foreign governments via MLAT process</li>
            <li><strong>Letters Rogatory:</strong> Formal requests through diplomatic channels</li>
            <li><strong>Direct Requests:</strong> In emergency situations, we may respond to direct requests from foreign law enforcement</li>
          </ul>
          <p>
            International requests must comply with U.S. law and be submitted in English or with certified translation.
          </p>
        </section>

        <div className="legal-footer-note">
          <p>
            <strong>Questions?</strong> Contact our Legal Department at legal@prydesocial.com or call [Phone Number - Coming Soon].
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

export default LegalRequests;

