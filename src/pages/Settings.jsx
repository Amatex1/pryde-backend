import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CustomModal from '../components/CustomModal';
import { useModal } from '../hooks/useModal';
import api from '../utils/api';
import { getCurrentUser, setCurrentUser, logout } from '../utils/auth';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  isPushNotificationSubscribed,
  sendTestNotification
} from '../utils/pushNotifications';
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
  const [pushEnabled, setPushEnabled] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState({
    isVerified: false,
    verificationRequested: false,
    verificationRequestDate: null
  });

  useEffect(() => {
    fetchUserData();
    checkPushStatus();
    fetchVerificationStatus();
  }, []);

  const checkPushStatus = async () => {
    const isSubscribed = await isPushNotificationSubscribed();
    setPushEnabled(isSubscribed);
  };

  const fetchVerificationStatus = async () => {
    try {
      const response = await api.get('/users/verification-status');
      setVerificationStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch verification status:', error);
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
    } catch (error) {
      console.error('Failed to fetch user data:', error);
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
      console.error('Update profile error:', error);
    } finally {
      setLoading(false);
    }
  };



  const handlePushToggle = async () => {
    try {
      if (pushEnabled) {
        const success = await unsubscribeFromPushNotifications();
        if (success) {
          setPushEnabled(false);
          setMessage('Push notifications disabled');
        } else {
          setMessage('Failed to disable push notifications');
        }
      } else {
        const success = await subscribeToPushNotifications();
        if (success) {
          setPushEnabled(true);
          setMessage('Push notifications enabled!');
        } else {
          setMessage('Failed to enable push notifications. Please allow notifications in your browser.');
        }
      }
    } catch (error) {
      console.error('Push toggle error:', error);
      setMessage('Failed to update push notification settings');
    }
  };

  const handleTestNotification = async () => {
    try {
      const success = await sendTestNotification();
      if (success) {
        setMessage('Test notification sent!');
      } else {
        setMessage('Failed to send test notification. Make sure notifications are enabled.');
      }
    } catch (error) {
      console.error('Test notification error:', error);
      setMessage('Failed to send test notification');
    }
  };

  const handleDownloadData = async () => {
    try {
      setMessage('Preparing your data...');
      console.log('📥 Requesting data download...');

      // Debug: Check if token exists
      const token = localStorage.getItem('token');
      console.log('🔑 Token exists:', !!token);
      console.log('🔑 Token preview:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');

      const response = await api.get('/users/download-data');
      console.log('✅ Data received:', response.data);

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
      console.error('Download data error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

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
      console.error('Deactivate account error:', error);
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
      console.error('Delete account error:', error);
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
      console.error('Verification request error:', error);
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
          {!verificationStatus.isVerified && (
            <div className="settings-section">
              <h2 className="section-title">✓ Account Verification</h2>

              <div className="verification-info">
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
              </div>
            </div>
          )}

          <div className="settings-section">
            <h2 className="section-title">Notifications</h2>
            
            <div className="notification-settings">
              <div className="notification-item">
                <div className="notification-info">
                  <h3>Push Notifications</h3>
                  <p>Receive notifications even when you're not using the app</p>
                </div>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={pushEnabled}
                    onChange={handlePushToggle}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {pushEnabled && (
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="btn-test"
                >
                  🔔 Send Test Notification
                </button>
              )}
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
