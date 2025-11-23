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
              <h2 className="section-title">Basic Information</h2>

              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="form-input glossy"
                  placeholder="Your full name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="displayName">Display Name</label>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  className="form-input glossy"
                  placeholder="How you want to be called"
                />
              </div>

              <div className="form-group">
                <label htmlFor="nickname">Nickname (Optional)</label>
                <input
                  type="text"
                  id="nickname"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  className="form-input glossy"
                  placeholder="Your nickname"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="pronouns">Pronouns</label>
                  <select
                    id="pronouns"
                    name="pronouns"
                    value={formData.pronouns}
                    onChange={handleChange}
                    className="form-input glossy"
                  >
                    <option value="">Select pronouns</option>
                    <option value="He/Him">He/Him</option>
                    <option value="She/Her">She/Her</option>
                    <option value="They/Them">They/Them</option>
                    <option value="He/They">He/They</option>
                    <option value="She/They">She/They</option>
                    <option value="Any Pronouns">Any Pronouns</option>
                    <option value="Prefer Not to Say">Prefer Not to Say</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                {formData.pronouns === 'Custom' && (
                  <div className="form-group">
                    <label htmlFor="customPronouns">Custom Pronouns</label>
                    <input
                      type="text"
                      id="customPronouns"
                      name="customPronouns"
                      value={formData.customPronouns}
                      onChange={handleChange}
                      className="form-input glossy"
                      placeholder="Enter your pronouns"
                    />
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="gender">Gender</label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="form-input glossy"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Transgender">Transgender</option>
                    <option value="Genderfluid">Genderfluid</option>
                    <option value="Agender">Agender</option>
                    <option value="Intersex">Intersex</option>
                    <option value="Prefer Not to Say">Prefer Not to Say</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                {formData.gender === 'Custom' && (
                  <div className="form-group">
                    <label htmlFor="customGender">Custom Gender</label>
                    <input
                      type="text"
                      id="customGender"
                      name="customGender"
                      value={formData.customGender}
                      onChange={handleChange}
                      className="form-input glossy"
                      placeholder="Enter your gender"
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="relationshipStatus">Relationship Status</label>
                <select
                  id="relationshipStatus"
                  name="relationshipStatus"
                  value={formData.relationshipStatus}
                  onChange={handleChange}
                  className="form-input glossy"
                >
                  <option value="">Select status</option>
                  <option value="Single">Single</option>
                  <option value="Taken">Taken</option>
                  <option value="It's Complicated">It's Complicated</option>
                  <option value="Married">Married</option>
                  <option value="Looking for Friends">Looking for Friends</option>
                  <option value="Prefer Not to Say">Prefer Not to Say</option>
                </select>
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

            <div className="settings-section">
              <h2 className="section-title">Social Links</h2>
              <p className="section-description">Add unlimited social media links to your profile</p>

              {formData.socialLinks.map((link, index) => (
                <div key={index} className="social-link-row">
                  <div className="form-group">
                    <input
                      type="text"
                      value={link.platform}
                      onChange={(e) => updateSocialLink(index, 'platform', e.target.value)}
                      className="form-input glossy"
                      placeholder="Platform (e.g., Instagram, Twitter)"
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => updateSocialLink(index, 'url', e.target.value)}
                      className="form-input glossy"
                      placeholder="https://..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSocialLink(index)}
                    className="btn-remove"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addSocialLink}
                className="btn-add-link glossy"
              >
                + Add Social Link
              </button>
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
