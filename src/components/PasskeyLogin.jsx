import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import api from '../utils/api';
import { setAuthToken, setCurrentUser } from '../utils/auth';
import './PasskeyLogin.css';

function PasskeyLogin({ onSuccess, email }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePasskeyLogin = async () => {
    try {
      setLoading(true);
      setError('');

      // Step 1: Start authentication
      const { data: options } = await api.post('/passkey/login-start', {
        email: email || undefined
      });

      // Step 2: Prompt user for biometric/PIN
      let credential;
      try {
        // @simplewebauthn/browser v13+ requires optionsJSON wrapper
        credential = await startAuthentication({ optionsJSON: options });
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          throw new Error('Passkey authentication was cancelled');
        }
        throw new Error('Failed to authenticate with passkey. Please try again.');
      }

      // Step 3: Complete authentication
      const { data } = await api.post('/passkey/login-finish', {
        credential,
        challengeKey: options.challengeKey
      });

      // Save auth token and user data
      setAuthToken(data.token);
      setCurrentUser(data.user);

      setLoading(false);

      if (onSuccess) {
        onSuccess(data.user);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to sign in with passkey');
      setLoading(false);
    }
  };

  return (
    <div className="passkey-login">
      {error && <div className="error-message">{error}</div>}

      <button
        onClick={handlePasskeyLogin}
        disabled={loading}
        className="btn-passkey"
      >
        <span className="passkey-icon">🔐</span>
        <span>{loading ? 'Authenticating...' : 'Sign in with Passkey'}</span>
      </button>

      <div className="passkey-help">
        <p>Use your fingerprint, face, or screen lock to sign in securely</p>
      </div>
    </div>
  );
}

export default PasskeyLogin;

