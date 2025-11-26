import { useState } from 'react';
import api from '../../utils/api';
import './TwoFactorSetup.css';

function TwoFactorSetup({ onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: Setup, 2: Verify, 3: Backup Codes
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.post('/2fa/setup');
      setQrCode(response.data.qrCode);
      setSecret(response.data.secret);
      setStep(2);
    } catch (err) {
      console.error('2FA setup error:', err);
      setError(err.response?.data?.message || 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await api.post('/2fa/verify', {
        token: verificationCode
      });
      
      setBackupCodes(response.data.backupCodes);
      setStep(3);
    } catch (err) {
      console.error('2FA verification error:', err);
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackupCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pryde-backup-codes.txt';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    alert('Backup codes copied to clipboard!');
  };

  const handleComplete = () => {
    onSuccess();
  };

  // Auto-start setup when component mounts
  useState(() => {
    handleSetup();
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content two-factor-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <h2 className="modal-title">🔐 Enable Two-Factor Authentication</h2>

        {error && (
          <div className="error-message" style={{ background: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '5px', marginBottom: '15px' }}>
            {error}
          </div>
        )}

        {/* Step 1: Loading/Setup */}
        {step === 1 && (
          <div className="setup-step">
            <p>Setting up two-factor authentication...</p>
            {loading && <div className="spinner"></div>}
          </div>
        )}

        {/* Step 2: Scan QR Code and Verify */}
        {step === 2 && (
          <div className="setup-step">
            <h3>Step 1: Scan QR Code</h3>
            <p style={{ color: '#616161', marginBottom: '15px' }}>
              Use an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator to scan this QR code:
            </p>

            {qrCode && (
              <div className="qr-code-container">
                <img src={qrCode} alt="2FA QR Code" style={{ maxWidth: '250px', margin: '0 auto', display: 'block' }} />
              </div>
            )}

            <div className="manual-entry" style={{ marginTop: '20px', padding: '15px', background: '#f7f7f7', borderRadius: '8px' }}>
              <p style={{ fontSize: '14px', marginBottom: '5px' }}><strong>Can't scan?</strong> Enter this code manually:</p>
              <code style={{ fontSize: '16px', fontWeight: 'bold', color: '#6C5CE7' }}>{secret}</code>
            </div>

            <h3 style={{ marginTop: '30px' }}>Step 2: Enter Verification Code</h3>
            <p style={{ color: '#616161', marginBottom: '15px' }}>
              Enter the 6-digit code from your authenticator app:
            </p>

            <form onSubmit={handleVerify}>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="verification-input"
                style={{
                  width: '100%',
                  padding: '15px',
                  fontSize: '24px',
                  textAlign: 'center',
                  letterSpacing: '10px',
                  fontWeight: 'bold',
                  border: '2px solid #E0E0E0',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}
                maxLength={6}
                autoFocus
              />

              <button
                type="submit"
                className="btn-primary"
                disabled={loading || verificationCode.length !== 6}
                style={{ width: '100%' }}
              >
                {loading ? 'Verifying...' : 'Verify and Enable 2FA'}
              </button>
            </form>
          </div>
        )}

        {/* Step 3: Backup Codes */}
        {step === 3 && (
          <div className="setup-step">
            <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3 style={{ color: '#155724', marginTop: 0 }}>✅ 2FA Enabled Successfully!</h3>
              <p style={{ color: '#155724', margin: 0 }}>
                Your account is now protected with two-factor authentication.
              </p>
            </div>

            <h3>⚠️ Save Your Backup Codes</h3>
            <p style={{ color: '#616161', marginBottom: '15px' }}>
              These backup codes can be used to access your account if you lose your authenticator device.
              <strong> Save them in a secure location!</strong>
            </p>

            <div className="backup-codes-container" style={{
              background: '#f7f7f7',
              border: '2px solid #E0E0E0',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '15px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {backupCodes.map((code, index) => (
                  <div key={index} style={{
                    background: 'white',
                    padding: '10px',
                    borderRadius: '5px',
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    color: '#6C5CE7'
                  }}>
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <button onClick={handleDownloadBackupCodes} className="btn-secondary" style={{ flex: 1 }}>
                📥 Download Codes
              </button>
              <button onClick={handleCopyBackupCodes} className="btn-secondary" style={{ flex: 1 }}>
                📋 Copy to Clipboard
              </button>
            </div>

            <button onClick={handleComplete} className="btn-primary" style={{ width: '100%' }}>
              ✅ I've Saved My Backup Codes
            </button>

            <p style={{ fontSize: '12px', color: '#856404', marginTop: '15px', textAlign: 'center' }}>
              ⚠️ You won't be able to see these codes again. Make sure to save them now!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TwoFactorSetup;

