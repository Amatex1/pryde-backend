import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './PasskeyBanner.css';

function PasskeyBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkPasskeyStatus();
  }, []);

  const checkPasskeyStatus = async () => {
    try {
      // Check if user has dismissed the banner
      const bannerDismissed = localStorage.getItem('passkeyBannerDismissed');
      if (bannerDismissed === 'true') {
        return;
      }

      // Check if user has any passkeys
      const response = await api.get('/passkey/list');
      const hasPasskeys = response.data.passkeys && response.data.passkeys.length > 0;

      // Show banner if user has no passkeys
      if (!hasPasskeys) {
        setShow(true);
      }
    } catch (error) {
      console.error('Failed to check passkey status:', error);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
    localStorage.setItem('passkeyBannerDismissed', 'true');
  };

  const handleSetupPasskey = () => {
    navigate('/settings/security');
  };

  if (!show || dismissed) {
    return null;
  }

  return (
    <div className="passkey-banner">
      <div className="passkey-banner-content">
        <div className="passkey-banner-icon">🔐</div>
        <div className="passkey-banner-text">
          <h3>Secure Your Account with a Passkey</h3>
          <p>
            Sign in faster and more securely with passkeys. No passwords to remember!
          </p>
        </div>
        <div className="passkey-banner-actions">
          <button onClick={handleSetupPasskey} className="btn-primary">
            Set Up Passkey
          </button>
          <button onClick={handleDismiss} className="btn-dismiss">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export default PasskeyBanner;

