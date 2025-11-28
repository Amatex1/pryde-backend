import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import api from '../utils/api';
import './PasskeySetup.css';

function PasskeySetup({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  const handleAddPasskey = async () => {
    try {
      setLoading(true);
      setError('');

      // Step 1: Start registration
      console.log('🔐 Starting passkey registration...');
      const { data: options } = await api.post('/passkey/register-start');
      console.log('✅ Received registration options:', options);

      // Step 2: Prompt user for biometric/PIN
      let credential;
      try {
        console.log('🔐 Calling startRegistration with options...');
        // @simplewebauthn/browser v13+ requires optionsJSON wrapper
        credential = await startRegistration({ optionsJSON: options });
        console.log('✅ Credential created:', credential);
      } catch (err) {
        console.error('❌ startRegistration error:', err);
        console.error('   Error name:', err.name);
        console.error('   Error message:', err.message);
        console.error('   Error stack:', err.stack);
        if (err.name === 'NotAllowedError') {
          throw new Error('Passkey creation was cancelled');
        }
        throw new Error(`Failed to create passkey: ${err.message}`);
      }

      // Step 3: Show device name input
      setShowNameInput(true);
      setLoading(false);

      // Wait for user to enter device name
      return { credential, options };
    } catch (err) {
      console.error('❌ handleAddPasskey error:', err);
      setError(err.message || 'Failed to create passkey');
      setLoading(false);
    }
  };

  const handleFinishRegistration = async (credential) => {
    try {
      setLoading(true);
      setError('');

      // Step 4: Complete registration
      const { data } = await api.post('/passkey/register-finish', {
        credential,
        deviceName: deviceName || 'My Device'
      });

      setLoading(false);
      setShowNameInput(false);
      setDeviceName('');

      if (onSuccess) {
        onSuccess(data.passkey);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save passkey');
      setLoading(false);
    }
  };

  const [pendingCredential, setPendingCredential] = useState(null);

  const startPasskeyCreation = async () => {
    const result = await handleAddPasskey();
    if (result) {
      setPendingCredential(result.credential);
    }
  };

  const finishPasskeyCreation = async () => {
    if (pendingCredential) {
      await handleFinishRegistration(pendingCredential);
      setPendingCredential(null);
    }
  };

  return (
    <div className="passkey-setup">
      {!showNameInput ? (
        <>
          <div className="passkey-info">
            <div className="passkey-icon">🔐</div>
            <h3>Add a Passkey</h3>
            <p>
              Passkeys are a safer and easier way to sign in. Use your fingerprint, face, or screen lock instead of a password.
            </p>
            <ul className="passkey-benefits">
              <li>✅ More secure than passwords</li>
              <li>✅ Faster sign-in with biometrics</li>
              <li>✅ Protected from phishing attacks</li>
              <li>✅ No password to remember</li>
            </ul>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            onClick={startPasskeyCreation}
            disabled={loading}
            className="btn-primary glossy-gold"
          >
            {loading ? 'Creating Passkey...' : 'Create Passkey'}
          </button>
        </>
      ) : (
        <>
          <div className="passkey-name-input">
            <h3>Name Your Device</h3>
            <p>Give this passkey a name so you can identify it later.</p>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g., iPhone 14, MacBook Pro"
              className="form-input glossy"
              autoFocus
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="passkey-actions">
            <button
              onClick={() => {
                setShowNameInput(false);
                setPendingCredential(null);
                setDeviceName('');
              }}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={finishPasskeyCreation}
              disabled={loading || !deviceName.trim()}
              className="btn-primary glossy-gold"
            >
              {loading ? 'Saving...' : 'Save Passkey'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default PasskeySetup;

