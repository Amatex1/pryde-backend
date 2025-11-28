import { useState, useEffect } from 'react';
import api from '../utils/api';
import PasskeySetup from './PasskeySetup';
import './PasskeyManager.css';

function PasskeyManager() {
  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddPasskey, setShowAddPasskey] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchPasskeys();
  }, []);

  const fetchPasskeys = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/passkey/list');
      setPasskeys(data.passkeys || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to load passkeys');
      setLoading(false);
    }
  };

  const handleDeletePasskey = async (credentialId) => {
    try {
      await api.delete(`/passkey/${credentialId}`);
      setPasskeys(passkeys.filter(pk => pk.id !== credentialId));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete passkey');
    }
  };

  const handlePasskeyAdded = (newPasskey) => {
    setPasskeys([...passkeys, newPasskey]);
    setShowAddPasskey(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRelativeTime = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Never';

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return formatDate(dateString);
  };

  if (loading) {
    return <div className="passkey-manager loading">Loading passkeys...</div>;
  }

  return (
    <div className="passkey-manager">
      <div className="passkey-header">
        <div>
          <h2>Passkeys</h2>
          <p>Manage your passkeys for secure, password-free sign-in</p>
        </div>
        {!showAddPasskey && (
          <button
            onClick={() => setShowAddPasskey(true)}
            className="btn-primary glossy-gold"
          >
            + Add Passkey
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {showAddPasskey && (
        <div className="passkey-add-section">
          <PasskeySetup onSuccess={handlePasskeyAdded} />
          <button
            onClick={() => setShowAddPasskey(false)}
            className="btn-cancel"
          >
            Cancel
          </button>
        </div>
      )}

      {passkeys.length === 0 && !showAddPasskey ? (
        <div className="passkey-empty">
          <div className="empty-icon">🔐</div>
          <h3>No Passkeys Yet</h3>
          <p>Add a passkey to enable secure, password-free sign-in</p>
        </div>
      ) : (
        <div className="passkey-list">
          {passkeys.map((passkey) => (
            <div key={passkey.id} className="passkey-item">
              <div className="passkey-icon-device">
                {passkey.deviceName.includes('iPhone') || passkey.deviceName.includes('iPad') ? '📱' :
                 passkey.deviceName.includes('Mac') ? '💻' :
                 passkey.deviceName.includes('Windows') ? '🖥️' :
                 passkey.deviceName.includes('Android') ? '📱' : '🔑'}
              </div>
              <div className="passkey-details">
                <h4>{passkey.deviceName}</h4>
                <div className="passkey-meta">
                  <span>Created {formatDate(passkey.createdAt)}</span>
                  <span>•</span>
                  <span>Last used {getRelativeTime(passkey.lastUsedAt)}</span>
                </div>
              </div>
              <button
                onClick={() => setDeleteConfirm(passkey.id)}
                className="btn-delete"
                title="Delete passkey"
              >
                🗑️
              </button>

              {deleteConfirm === passkey.id && (
                <div className="delete-confirm-modal">
                  <div className="delete-confirm-content">
                    <h3>Delete Passkey?</h3>
                    <p>Are you sure you want to delete "{passkey.deviceName}"?</p>
                    <div className="delete-confirm-actions">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeletePasskey(passkey.id)}
                        className="btn-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PasskeyManager;

