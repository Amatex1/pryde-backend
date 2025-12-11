import { useState, useEffect } from 'react';
import api from '../utils/api';
import './RecoveryContacts.css';

const RecoveryContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const response = await api.get('/recovery-contacts');
      setContacts(response.data.recoveryContacts || []);
    } catch (error) {
      console.error('Error fetching recovery contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await api.get('/users/search', {
        params: { q: searchQuery }
      });
      setSearchResults(response.data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (showAddForm) searchUsers();
    }, 500);
    return () => clearTimeout(delaySearch);
  }, [searchQuery, showAddForm]);

  const addContact = async (userId) => {
    try {
      await api.post('/recovery-contacts', { userId });

      setShowAddForm(false);
      setSearchQuery('');
      setSearchResults([]);
      fetchContacts();
      alert('Recovery contact request sent!');
    } catch (error) {
      console.error('Error adding contact:', error);
      alert(error.response?.data?.message || 'Failed to add recovery contact');
    }
  };

  const removeContact = async (contactId) => {
    if (!window.confirm('Remove this recovery contact?')) return;

    try {
      await api.delete(`/recovery-contacts/${contactId}`);
      fetchContacts();
    } catch (error) {
      console.error('Error removing contact:', error);
      alert('Failed to remove recovery contact');
    }
  };

  const acceptContact = async (contactId) => {
    try {
      await api.post(`/recovery-contacts/${contactId}/accept`);
      fetchContacts();
      alert('Recovery contact accepted!');
    } catch (error) {
      console.error('Error accepting contact:', error);
      alert('Failed to accept recovery contact');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Pending', class: 'status-pending' },
      accepted: { text: 'Active', class: 'status-accepted' },
      declined: { text: 'Declined', class: 'status-declined' }
    };
    return badges[status] || badges.pending;
  };

  if (loading) {
    return <div className="recovery-contacts-loading">Loading recovery contacts...</div>;
  }

  const acceptedContacts = contacts.filter(c => c.status === 'accepted');
  const pendingContacts = contacts.filter(c => c.status === 'pending');

  return (
    <div className="recovery-contacts">
      <div className="recovery-header">
        <div className="recovery-info">
          <h3>Trusted Recovery Contacts</h3>
          <p>Add trusted friends who can help you recover your account if you lose access.</p>
          <p className="recovery-note">
            ⚠️ You need at least 2 accepted contacts. They can approve password reset requests.
          </p>
        </div>
        {!showAddForm && acceptedContacts.length < 5 && (
          <button className="add-contact-btn" onClick={() => setShowAddForm(true)}>
            + Add Contact
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="add-contact-form">
          <div className="form-header">
            <h4>Add Recovery Contact</h4>
            <button className="close-form-btn" onClick={() => {
              setShowAddForm(false);
              setSearchQuery('');
              setSearchResults([]);
            }}>
              ✕
            </button>
          </div>
          <input
            type="text"
            placeholder="Search users by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-user-input"
          />
          {searching && <div className="searching">Searching...</div>}
          <div className="search-results-list">
            {searchResults.map(user => (
              <div key={user._id} className="user-result">
                <img src={user.profilePhoto || '/default-avatar.png'} alt={user.username} />
                <div className="user-info">
                  <div className="user-name">{user.displayName || user.username}</div>
                  <div className="user-username">@{user.username}</div>
                </div>
                <button onClick={() => addContact(user._id)}>Add</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="contacts-list">
        {acceptedContacts.length > 0 && (
          <div className="contacts-section">
            <h4>Active Contacts ({acceptedContacts.length})</h4>
            {acceptedContacts.map(contact => {
              const user = contact.user;
              return (
                <div key={contact._id} className="contact-item">
                  <img src={user.profilePhoto || '/default-avatar.png'} alt={user.username} className="contact-avatar" />
                  <div className="contact-info">
                    <div className="contact-name">{user.displayName || user.username}</div>
                    <div className="contact-username">@{user.username}</div>
                  </div>
                  <span className={`contact-status ${getStatusBadge(contact.status).class}`}>
                    {getStatusBadge(contact.status).text}
                  </span>
                  <button className="remove-contact-btn" onClick={() => removeContact(contact._id)}>Remove</button>
                </div>
              );
            })}
          </div>
        )}

        {pendingContacts.length > 0 && (
          <div className="contacts-section">
            <h4>Pending Requests ({pendingContacts.length})</h4>
            {pendingContacts.map(contact => {
              const user = contact.user;
              return (
                <div key={contact._id} className="contact-item">
                  <img src={user.profilePhoto || '/default-avatar.png'} alt={user.username} className="contact-avatar" />
                  <div className="contact-info">
                    <div className="contact-name">{user.displayName || user.username}</div>
                    <div className="contact-username">@{user.username}</div>
                  </div>
                  <span className={`contact-status ${getStatusBadge(contact.status).class}`}>
                    {getStatusBadge(contact.status).text}
                  </span>
                  <button className="remove-contact-btn" onClick={() => removeContact(contact._id)}>Cancel</button>
                </div>
              );
            })}
          </div>
        )}

        {contacts.length === 0 && (
          <div className="no-contacts">
            <p>No recovery contacts added yet.</p>
            <p>Add trusted friends to help you recover your account if needed.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecoveryContacts;

