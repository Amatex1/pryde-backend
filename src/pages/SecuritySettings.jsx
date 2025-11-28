import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TwoFactorSetup from '../components/security/TwoFactorSetup';
import SessionManagement from '../components/security/SessionManagement';
import PasskeyManager from '../components/PasskeyManager';
import CustomModal from '../components/CustomModal';
import { useModal } from '../hooks/useModal';
import api from '../utils/api';
import './Settings.css';

function SecuritySettings() {
  const navigate = useNavigate();
  const { modalState, closeModal, showPrompt } = useModal();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [twoFactorStatus, setTwoFactorStatus] = useState({
    enabled: false,
    backupCodesRemaining: 0
  });
  const [loginAlerts, setLoginAlerts] = useState({
    enabled: true,
    emailOnNewDevice: true,
    emailOnSuspiciousLogin: true
  });
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);

  useEffect(() => {
    fetchSecuritySettings();
  }, []);

  const fetchSecuritySettings = async () => {
    try {
      setLoading(true);
      
      // Fetch 2FA status
      const twoFactorResponse = await api.get('/2fa/status');
      setTwoFactorStatus(twoFactorResponse.data);

      // Fetch user data for login alerts
      const userResponse = await api.get('/auth/me');
      if (userResponse.data.loginAlerts) {
        setLoginAlerts(userResponse.data.loginAlerts);
      }
    } catch (error) {
      console.error('Failed to fetch security settings:', error);
      setMessage('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginAlertsChange = async (field, value) => {
    try {
      const updatedAlerts = { ...loginAlerts, [field]: value };
      setLoginAlerts(updatedAlerts);

      await api.put('/users/profile', { loginAlerts: updatedAlerts });
      setMessage('Login alert settings updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to update login alerts:', error);
      setMessage('Failed to update login alert settings');
    }
  };

  const handleDisable2FA = async () => {
    const password = await showPrompt('Enter your password to disable 2FA:', 'Disable 2FA', 'Password', '', 'password');
    if (!password) return;

    try {
      await api.post('/2fa/disable', { password });
      setMessage('Two-factor authentication disabled successfully');
      setTwoFactorStatus({ enabled: false, backupCodesRemaining: 0 });
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to disable 2FA:', error);
      setMessage(error.response?.data?.message || 'Failed to disable 2FA');
    }
  };

  const handleRegenerateBackupCodes = async () => {
    const password = await showPrompt('Enter your password to regenerate backup codes:', 'Regenerate Backup Codes', 'Password', '', 'password');
    if (!password) return;

    try {
      const response = await api.post('/2fa/regenerate-backup-codes', { password });
      
      // Download backup codes
      const blob = new Blob([response.data.backupCodes.join('\n')], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pryde-backup-codes.txt';
      a.click();
      window.URL.revokeObjectURL(url);

      setMessage('Backup codes regenerated successfully. Please save them in a secure location.');
      setTwoFactorStatus({ ...twoFactorStatus, backupCodesRemaining: 10 });
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('Failed to regenerate backup codes:', error);
      setMessage(error.response?.data?.message || 'Failed to regenerate backup codes');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="settings-container">
          <div className="settings-card glossy fade-in">
            <p>Loading security settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />
      
      <div className="settings-container">
        <div className="settings-card glossy fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <button 
              onClick={() => navigate('/settings')} 
              className="btn-secondary"
              style={{ padding: '8px 12px' }}
            >
              ← Back to Settings
            </button>
            <h1 className="settings-title text-shadow">🔐 Security Settings</h1>
          </div>

          {message && (
            <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          {/* Passkeys Section */}
          <div className="settings-section">
            <PasskeyManager />
          </div>

          {/* Two-Factor Authentication Section */}
          <div className="settings-section">
            <h2 className="section-title">Two-Factor Authentication (2FA)</h2>
            <p style={{ color: '#616161', marginBottom: '15px' }}>
              Add an extra layer of security to your account by requiring a verification code in addition to your password.
            </p>

            {twoFactorStatus.enabled ? (
              <div className="security-status-card" style={{ background: '#d4edda', border: '1px solid #c3e6cb', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '24px' }}>✅</span>
                  <div>
                    <strong style={{ color: '#155724' }}>2FA is enabled</strong>
                    <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#155724' }}>
                      Your account is protected with two-factor authentication
                    </p>
                  </div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '14px', color: '#155724' }}>
                  <strong>Backup codes remaining:</strong> {twoFactorStatus.backupCodesRemaining} / 10
                </div>
                <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                  <button onClick={handleRegenerateBackupCodes} className="btn-secondary">
                    🔄 Regenerate Backup Codes
                  </button>
                  <button onClick={handleDisable2FA} className="btn-danger">
                    ❌ Disable 2FA
                  </button>
                </div>
              </div>
            ) : (
              <div className="security-status-card" style={{ background: '#fff3cd', border: '1px solid #ffeaa7', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  <div>
                    <strong style={{ color: '#856404' }}>2FA is not enabled</strong>
                    <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#856404' }}>
                      Your account is less secure without two-factor authentication
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTwoFactorSetup(true)}
                  className="btn-primary"
                  style={{ marginTop: '10px' }}
                >
                  🔒 Enable 2FA
                </button>
              </div>
            )}

            {showTwoFactorSetup && !twoFactorStatus.enabled && (
              <TwoFactorSetup
                onClose={() => setShowTwoFactorSetup(false)}
                onSuccess={() => {
                  setShowTwoFactorSetup(false);
                  fetchSecuritySettings();
                  setMessage('Two-factor authentication enabled successfully!');
                  setTimeout(() => setMessage(''), 5000);
                }}
              />
            )}
          </div>

          {/* Login Alerts Section */}
          <div className="settings-section">
            <h2 className="section-title">Login Alerts</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Get notified when someone logs into your account from a new device or location.
            </p>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={loginAlerts.enabled}
                  onChange={(e) => handleLoginAlertsChange('enabled', e.target.checked)}
                />
                <span>Enable login alerts</span>
              </label>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginLeft: '24px' }}>
                Receive email notifications when you log in
              </p>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={loginAlerts.emailOnNewDevice}
                  onChange={(e) => handleLoginAlertsChange('emailOnNewDevice', e.target.checked)}
                  disabled={!loginAlerts.enabled}
                />
                <span>Email on new device login</span>
              </label>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginLeft: '24px' }}>
                Get notified when you log in from a device we don't recognize
              </p>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={loginAlerts.emailOnSuspiciousLogin}
                  onChange={(e) => handleLoginAlertsChange('emailOnSuspiciousLogin', e.target.checked)}
                  disabled={!loginAlerts.enabled}
                />
                <span>Email on suspicious login</span>
              </label>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginLeft: '24px' }}>
                Get alerted if we detect unusual login activity
              </p>
            </div>
          </div>

          {/* Active Sessions Section */}
          <div className="settings-section">
            <h2 className="section-title">Active Sessions</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
              Manage devices and locations where you're currently logged in.
            </p>

            <SessionManagement />
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

export default SecuritySettings;

