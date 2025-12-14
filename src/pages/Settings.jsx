import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CustomModal from '../components/CustomModal';
import { useModal } from '../hooks/useModal';
import api from '../utils/api';
import { getCurrentUser, setCurrentUser, logout } from '../utils/auth';
import { applyQuietMode } from '../utils/quietMode';
import logger from './utils/logger';
import './Settings.css';

function Settings() {
  const { modalState, closeModal, showAlert, showConfirm, showPrompt } = useModal();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [formData, setFormData] = useState({
    fullName: '',
    displayName: '',
    nickname: '',
    pronouns: '',
    customPronouns: '',
    gender: '',
    customGender: '',
    relationshipStatus: '',
    bio: '',
    location: '',
    website: '',
    socialLinks: []
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [quietModeEnabled, setQuietModeEnabled] = useState(false); // PHASE 2: Quiet Mode
  const [isCreator, setIsCreator] = useState(false); // PHASE 5: Creator Mode
  const [verificationStatus, setVerificationStatus] = useState({
    isVerified: false,
    verificationRequested: false,
    verificationRequestDate: null
  });

  useEffect(() => {
    fetchUserData();
    fetchVerificationStatus();
  }, []);

  const fetchVerificationStatus = async () => {
    try {
      const response = await api.get('/users/verification-status');
      setVerificationStatus(response.data);
    } catch (error) {
      logger.error('Failed to fetch verification status:', error);
    }
  };

  const fetchUserData = async () => {
    try {
      const response = await api.get('/auth/me');
      const user = response.data;
      setFormData({
        fullName: user.fullName || '',
        displayName: user.displayName || '',
        nickname: user.nickname || '',
        pronouns: user.pronouns || '',
        customPronouns: user.customPronouns || '',
        gender: user.gender || '',
        customGender: user.customGender || '',
        relationshipStatus: user.relationshipStatus || '',
        bio: user.bio || '',
        location: user.location || '',
        website: user.website || '',
        socialLinks: user.socialLinks || []
      });
      // PHASE 2: Load quiet mode settings
      const quietMode = user.privacySettings?.quietModeEnabled || false;
      setQuietModeEnabled(quietMode);
      applyQuietMode(quietMode);
      localStorage.setItem('quietMode', quietMode);

      // PHASE 5: Load creator mode setting
      setIsCreator(user.isCreator || false);
    } catch (error) {
      logger.error('Failed to fetch user data:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const addSocialLink = () => {
    setFormData({
      ...formData,
      socialLinks: [...formData.socialLinks, { platform: '', url: '' }]
    });
  };

  const removeSocialLink = (index) => {
    const newLinks = formData.socialLinks.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      socialLinks: newLinks
    });
  };

  const updateSocialLink = (index, field, value) => {
    const newLinks = [...formData.socialLinks];
    newLinks[index][field] = value;
    setFormData({
      ...formData,
      socialLinks: newLinks
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await api.put('/users/profile', formData);
      setCurrentUser({ ...currentUser, ...response.data });
      setMessage('Profile updated successfully!');
    } catch (error) {
      setMessage('Failed to update profile');
      logger.error('Update profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  // PHASE 2: Handle Quiet Mode toggle
  const handleQuietModeToggle = async () => {
    try {
      const newValue = !quietModeEnabled;
      await api.patch('/users/me/settings', { quietModeEnabled: newValue });
      setQuietModeEnabled(newValue);
      setMessage(newValue ? 'Quiet Mode enabled' : 'Quiet Mode disabled');
      applyQuietMode(newValue);
      localStorage.setItem('quietMode', newValue);
    } catch (error) {
      logger.error('Failed to toggle quiet mode:', error);
      setMessage('Failed to update quiet mode');
    }
  };

  // PHASE 5: Handle Creator Mode toggle
  const handleCreatorModeToggle = async () => {
    try {
      const newValue = !isCreator;
      await api.patch('/users/me/creator', { isCreator: newValue });
      setIsCreator(newValue);
      setMessage(newValue ? 'Creator Mode enabled' : 'Creator Mode disabled');
    } catch (error) {
      logger.error('Failed to toggle creator mode:', error);
      setMessage('Failed to update creator mode');
    }
  };

  const handleDownloadData = async () => {
    try {
      setMessage('Preparing your data...');
      logger.debug('📥 Requesting data download...');

      // Debug: Check if token exists
      const token = localStorage.getItem('token');
      logger.debug('🔑 Token exists:', !!token);
      logger.debug('🔑 Token preview:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');

      const response = await api.get('/users/download-data');
      logger.debug('✅ Data received:', response.data);

      // Create a blob and download
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pryde-social-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage('Your data has been downloaded!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      logger.error('Download data error:', error);
      logger.error('Error response:', error.response?.data);
      logger.error('Error status:', error.response?.status);

      if (error.response?.status === 401) {
        setMessage('Authentication failed. Please log in again.');
      } else {
        setMessage(`Failed to download data: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  const handleDeactivateAccount = async () => {
    const confirmed = await showConfirm(
      'Your profile will be hidden and you won\'t be able to use Pryde Social until you reactivate.\n\n' +
      'You can reactivate by logging in again.',
      'Deactivate Account?',
      'Deactivate',
      'Cancel'
    );

    if (!confirmed) return;

    try {
      await api.put('/users/deactivate');
      logout();
      navigate('/login');
      showAlert('Your account has been deactivated. You can reactivate by logging in again.', 'Account Deactivated');
    } catch (error) {
      logger.error('Deactivate account error:', error);
      setMessage('Failed to deactivate account');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = await showConfirm(
      '⚠️ WARNING: This action is PERMANENT and CANNOT be undone!\n\n' +
      'This will permanently delete:\n' +
      '• Your profile and all personal information\n' +
      '• All your posts and comments\n' +
      '• All your messages\n' +
      '• All your friend connections\n' +
      '• Everything associated with your account\n\n' +
      'Type "DELETE" in the next prompt to confirm.',
      'Delete Account Permanently?',
      'Continue',
      'Cancel'
    );

    if (!confirmed) return;

    const confirmation = await showPrompt('Type DELETE to confirm account deletion:', 'Confirm Deletion', 'Type DELETE');

    if (confirmation !== 'DELETE') {
      showAlert('Account deletion cancelled. You must type DELETE exactly to confirm.', 'Cancelled');
      return;
    }

    try {
      await api.delete('/users/account');
      logout();
      navigate('/');
      showAlert('Your account has been permanently deleted.', 'Account Deleted');
    } catch (error) {
      logger.error('Delete account error:', error);
      setMessage('Failed to delete account');
    }
  };

  const handleRequestVerification = async () => {
    const reason = await showPrompt(
      'Please explain why you would like to be verified (e.g., LGBTQ+ activist, content creator, community leader):',
      'Request Verification',
      'Enter reason (max 500 characters)'
    );

    if (!reason || reason.trim().length === 0) {
      return;
    }

    if (reason.length > 500) {
      showAlert('Reason must be 500 characters or less', 'Too Long');
      return;
    }

    try {
      const response = await api.post('/users/verification-request', { reason });
      showAlert(response.data.message, 'Request Submitted');
      fetchVerificationStatus();
    } catch (error) {
      logger.error('Verification request error:', error);
      showAlert(error.response?.data?.message || 'Failed to submit verification request', 'Error');
    }
  };

  return (
    <div className="page-container">
      <Navbar />

      <div className="settings-container">
        <div className="settings-card glossy fade-in">
          <h1 className="settings-title text-shadow">⚙️ Settings</h1>

          {message && (
            <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          {/* Security Settings Link */}
          <div className="settings-section security-settings-link">
            <div className="security-settings-content">
              <div className="security-settings-info">
                <h2 className="section-title">🔐 Security Settings</h2>
                <p className="security-settings-description">
                  Manage passkeys, 2FA, active sessions, and login alerts
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/settings/security')}
                className="btn-primary"
                style={{ whiteSpace: 'nowrap' }}
              >
                Manage Security →
              </button>
            </div>
          </div>

          {/* Privacy Settings Link */}
          <div className="settings-section" style={{ background: 'linear-gradient(135deg, #EDEAFF 0%, #F7F7F7 100%)', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 className="section-title" style={{ margin: 0, marginBottom: '5px' }}>🔒 Privacy Settings</h2>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '14px' }}>
                  Control who can see your profile, send messages, and more
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/settings/privacy')}
                className="btn-primary"
                style={{ whiteSpace: 'nowrap' }}
              >
                Manage Privacy →
              </button>
            </div>
          </div>

          {/* Basic Information moved to Edit Profile modal on Profile page */}

          {/* Verification Request Section */}
          <div className="settings-section">
            <h2 className="section-title">✓ Account Verification</h2>

            <div className="verification-info">
              {verificationStatus.isVerified ? (
                <div className="verification-verified">
                  <div className="verified-icon">✓</div>
                  <div className="verified-text">
                    <h3>Account Verified</h3>
                    <p>
                      Your account is verified! You have a blue checkmark badge on your profile and posts.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p>
                    Verified accounts receive a blue checkmark badge on their profile and posts.
                    Verification is available for LGBTQ+ activists, content creators, community leaders,
                    and other notable members of the community.
                  </p>

                  {verificationStatus.verificationRequested ? (
                    <div className="verification-pending">
                      <div className="pending-icon">⏳</div>
                      <div className="pending-text">
                        <h3>Verification Request Pending</h3>
                        <p>
                          Your verification request is under review.
                          Submitted on {new Date(verificationStatus.verificationRequestDate).toLocaleDateString()}
                        </p>
                        <p className="muted-text">
                          An admin will review your request and contact you if additional information is needed.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestVerification}
                      className="btn-verification"
                    >
                      ✓ Request Verification
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* PHASE 2: Quiet Mode */}
          <div className="settings-section">
            <h2 className="section-title">🌿 Quiet Mode</h2>
            <p className="section-description">
              A peaceful browsing experience with softer colors and hidden metrics.
              Perfect for introverts, late-night users, and anyone who prefers a calmer space.
            </p>

            <div className="notification-settings">
              <div className="notification-item">
                <div className="notification-info">
                  <h3>Enable Quiet Mode</h3>
                  <p>Manually enable Quiet Mode for a calm, distraction-free experience.</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="quiet-mode-toggle"
                    name="quietMode"
                    checked={quietModeEnabled}
                    onChange={handleQuietModeToggle}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* PHASE 5: Creator Mode */}
          <div className="settings-section">
            <h2 className="section-title">🎨 Creator Mode</h2>

            <div className="notification-settings">
              <div className="notification-item">
                <div className="notification-info">
                  <h3>Enable Creator Mode</h3>
                  <p>Unlock creator features like photo essays, featured posts, and a dedicated creator profile. Perfect for artists, writers, and content creators.</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="creator-mode-toggle"
                    name="creatorMode"
                    checked={isCreator}
                    onChange={handleCreatorModeToggle}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <div className="settings-section danger-zone">
            <h2 className="section-title">Account Management</h2>

            <div className="account-actions">
              <div className="action-item">
                <div className="action-info">
                  <h3>📥 Download Your Data</h3>
                  <p>Download a copy of all your data including posts, messages, and profile information</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadData}
                  className="btn-download"
                >
                  Download Data
                </button>
              </div>

              <div className="action-item">
                <div className="action-info">
                  <h3>⏸️ Deactivate Account</h3>
                  <p>Temporarily deactivate your account. You can reactivate by logging in again.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDeactivateAccount}
                  className="btn-deactivate"
                >
                  Deactivate Account
                </button>
              </div>

              <div className="action-item danger">
                <div className="action-info">
                  <h3>🗑️ Delete Account</h3>
                  <p className="danger-text">Permanently delete your account and all associated data. This action cannot be undone!</p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="btn-delete-account"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h2 className="section-title">Legal & Policies</h2>

            <div className="legal-links">
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="legal-link">
                <div className="legal-link-content">
                  <div className="legal-icon">📄</div>
                  <div className="legal-info">
                    <h3>Terms of Service</h3>
                    <p>Read our terms and conditions</p>
                  </div>
                </div>
                <span className="legal-arrow">→</span>
              </a>

              <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="legal-link">
                <div className="legal-link-content">
                  <div className="legal-icon">🔒</div>
                  <div className="legal-info">
                    <h3>Privacy Policy</h3>
                    <p>Learn how we protect your data</p>
                  </div>
                </div>
                <span className="legal-arrow">→</span>
              </a>

              <a href="/cookie-policy" target="_blank" rel="noopener noreferrer" className="legal-link">
                <div className="legal-link-content">
                  <div className="legal-icon">🍪</div>
                  <div className="legal-info">
                    <h3>Cookie Policy</h3>
                    <p>How we use cookies</p>
                  </div>
                </div>
                <span className="legal-arrow">→</span>
              </a>

              <a href="/community-guidelines" target="_blank" rel="noopener noreferrer" className="legal-link">
                <div className="legal-link-content">
                  <div className="legal-icon">👥</div>
                  <div className="legal-info">
                    <h3>Community Guidelines</h3>
                    <p>Our community standards and rules</p>
                  </div>
                </div>
                <span className="legal-arrow">→</span>
              </a>

              <a href="/acceptable-use" target="_blank" rel="noopener noreferrer" className="legal-link">
                <div className="legal-link-content">
                  <div className="legal-icon">✅</div>
                  <div className="legal-info">
                    <h3>Acceptable Use Policy</h3>
                    <p>Guidelines for using our platform</p>
                  </div>
                </div>
                <span className="legal-arrow">→</span>
              </a>

              <a href="/dmca" target="_blank" rel="noopener noreferrer" className="legal-link">
                <div className="legal-link-content">
                  <div className="legal-icon">©️</div>
                  <div className="legal-info">
                    <h3>DMCA Policy</h3>
                    <p>Copyright and intellectual property</p>
                  </div>
                </div>
                <span className="legal-arrow">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <CustomModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        placeholder={modalState.placeholder}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={modalState.onConfirm}
        inputType={modalState.inputType}
        defaultValue={modalState.defaultValue}
      />
    </div>
  );
}

export default Settings;
