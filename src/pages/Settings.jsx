import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { getCurrentUser, setCurrentUser } from '../utils/auth';
import { 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications, 
  isPushNotificationSubscribed,
  sendTestNotification 
} from '../utils/pushNotifications';
import './Settings.css';

function Settings() {
  const currentUser = getCurrentUser();
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    location: '',
    website: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    fetchUserData();
    checkPushStatus();
  }, []);

  const checkPushStatus = async () => {
    const isSubscribed = await isPushNotificationSubscribed();
    setPushEnabled(isSubscribed);
  };

  const fetchUserData = async () => {
    try {
      const response = await api.get('/auth/me');
      const user = response.data;
      setFormData({
        displayName: user.displayName || '',
        bio: user.bio || '',
        location: user.location || '',
        website: user.website || ''
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

  const handlePhotoUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const endpoint = type === 'profile' ? '/upload/profile-photo' : '/upload/cover-photo';
      await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage(`${type === 'profile' ? 'Profile' : 'Cover'} photo updated!`);
      fetchUserData();
    } catch (error) {
      setMessage('Failed to upload photo');
      console.error('Upload error:', error);
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

          <div className="settings-section">
            <h2 className="section-title">Profile Photos</h2>
            <div className="photo-uploads">
              <div className="upload-group">
                <label htmlFor="profile-photo" className="upload-label">
                  Profile Photo
                </label>
                <input
                  type="file"
                  id="profile-photo"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e, 'profile')}
                  className="file-input"
                />
              </div>

              <div className="upload-group">
                <label htmlFor="cover-photo" className="upload-label">
                  Cover Photo
                </label>
                <input
                  type="file"
                  id="cover-photo"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e, 'cover')}
                  className="file-input"
                />
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="settings-form">
            <div className="settings-section">
              <h2 className="section-title">Profile Information</h2>
              
              <div className="form-group">
                <label htmlFor="displayName">Display Name</label>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  className="form-input glossy"
                  placeholder="Your display name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  className="form-input glossy"
                  rows="4"
                  maxLength="500"
                  placeholder="Tell us about yourself"
                />
                <small className="char-count">{formData.bio.length}/500</small>
              </div>

              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="form-input glossy"
                  placeholder="Where are you from?"
                />
              </div>

              <div className="form-group">
                <label htmlFor="website">Website</label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="form-input glossy"
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-save glossy-gold">
              {loading ? 'Saving...' : 'Save Changes ✨'}
            </button>
          </form>

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
        </div>
      </div>
    </div>
  );
}

export default Settings;
