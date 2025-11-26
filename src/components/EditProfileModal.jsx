import { useState, useEffect } from 'react';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
import './EditProfileModal.css';

function EditProfileModal({ isOpen, onClose, user, onUpdate }) {
  const [formData, setFormData] = useState({
    fullName: '',
    nickname: '',
    displayNameType: 'fullName', // 'fullName', 'nickname', 'custom'
    customDisplayName: '',
    pronouns: '',
    gender: '',
    sexualOrientation: '',
    relationshipStatus: '',
    birthday: '',
    bio: '',
    postcode: '',
    city: '',
    website: '',
    socialLinks: [],
    interests: [],
    lookingFor: [],
    communicationStyle: '',
    safetyPreferences: '',
    profilePhoto: null,
    coverPhoto: null
  });

  const [newInterest, setNewInterest] = useState('');
  const [newSocialLink, setNewSocialLink] = useState({ platform: '', url: '' });
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        fullName: user.fullName || '',
        nickname: user.nickname || '',
        displayNameType: user.displayNameType || 'fullName',
        customDisplayName: user.customDisplayName || '',
        pronouns: user.pronouns || '',
        gender: user.gender || '',
        sexualOrientation: user.sexualOrientation || '',
        relationshipStatus: user.relationshipStatus || '',
        birthday: user.birthday ? user.birthday.split('T')[0] : '',
        bio: user.bio || '',
        postcode: user.postcode || '',
        city: user.city || '',
        website: user.website || '',
        socialLinks: user.socialLinks || [],
        interests: user.interests || [],
        lookingFor: user.lookingFor || [],
        communicationStyle: user.communicationStyle || '',
        safetyPreferences: user.safetyPreferences || '',
        profilePhoto: null,
        coverPhoto: null
      });
    }
  }, [isOpen, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddInterest = () => {
    if (newInterest.trim() && !formData.interests.includes(newInterest.trim())) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, newInterest.trim()]
      }));
      setNewInterest('');
    }
  };

  const handleRemoveInterest = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }));
  };

  const handleAddSocialLink = () => {
    if (newSocialLink.platform.trim() && newSocialLink.url.trim()) {
      setFormData(prev => ({
        ...prev,
        socialLinks: [...prev.socialLinks, { ...newSocialLink }]
      }));
      setNewSocialLink({ platform: '', url: '' });
    }
  };

  const handleRemoveSocialLink = (index) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((_, i) => i !== index)
    }));
  };

  const toggleLookingFor = (option) => {
    setFormData(prev => ({
      ...prev,
      lookingFor: prev.lookingFor.includes(option)
        ? prev.lookingFor.filter(o => o !== option)
        : [...prev.lookingFor, option]
    }));
  };

  const handlePhotoUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);
    const formDataUpload = new FormData();
    formDataUpload.append('photo', file);

    try {
      const endpoint = type === 'profile' ? '/upload/profile-photo' : '/upload/cover-photo';
      const response = await api.post(endpoint, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (type === 'profile') {
        setFormData(prev => ({ ...prev, profilePhoto: response.data.url }));
      } else {
        setFormData(prev => ({ ...prev, coverPhoto: response.data.url }));
      }
    } catch (error) {
      console.error('Failed to upload photo:', error);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.fullName.trim()) {
      alert('Full Name is required');
      return;
    }

    setLoading(true);
    try {
      const response = await api.put('/users/profile', formData);
      onUpdate(response.data.user);
      onClose();
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-profile-header">
          <h2>✏️ Edit Profile</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="edit-profile-form">
          <div className="form-body">
            {/* Visual Section */}
            <section className="form-section">
              <h3>📸 Visual</h3>

              <div className="photo-uploads">
                <div className="photo-upload-item">
                  <label>Profile Photo</label>
                  <div className="photo-preview">
                    {formData.profilePhoto || user?.profilePhoto ? (
                      <img src={getImageUrl(formData.profilePhoto || user.profilePhoto)} alt="Profile" />
                    ) : (
                      <div className="photo-placeholder">No photo</div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, 'profile')}
                    disabled={uploadingPhoto}
                  />
                </div>

                <div className="photo-upload-item">
                  <label>Cover Photo</label>
                  <div className="photo-preview cover">
                    {formData.coverPhoto || user?.coverPhoto ? (
                      <img src={getImageUrl(formData.coverPhoto || user.coverPhoto)} alt="Cover" />
                    ) : (
                      <div className="photo-placeholder">No cover photo</div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, 'cover')}
                    disabled={uploadingPhoto}
                  />
                </div>
              </div>
            </section>

            {/* Basic Information */}
            <section className="form-section">
              <h3>ℹ️ Basic Information</h3>

              <div className="form-group">
                <label>Full Name <span className="required">*</span></label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="Enter your full name"
                />
              </div>

              <div className="form-group">
                <label>Nickname</label>
                <input
                  type="text"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  placeholder="Enter a nickname (optional)"
                />
              </div>

              <div className="form-group">
                <label>Display Name</label>
                <select
                  name="displayNameType"
                  value={formData.displayNameType}
                  onChange={handleChange}
                >
                  <option value="fullName">Full Name</option>
                  <option value="nickname">Nickname</option>
                  <option value="custom">Custom</option>
                </select>
                {formData.displayNameType === 'custom' && (
                  <input
                    type="text"
                    name="customDisplayName"
                    value={formData.customDisplayName}
                    onChange={handleChange}
                    placeholder="Enter custom display name"
                    className="mt-2"
                  />
                )}
              </div>

              <div className="form-group">
                <label>Pronouns</label>
                <input
                  type="text"
                  name="pronouns"
                  value={formData.pronouns}
                  onChange={handleChange}
                  placeholder="e.g., she/her, he/him, they/them"
                />
              </div>

              <div className="form-group">
                <label>Gender</label>
                <input
                  type="text"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  placeholder="Enter your gender (optional)"
                />
              </div>

              <div className="form-group">
                <label>Sexual Orientation</label>
                <select
                  name="sexualOrientation"
                  value={formData.sexualOrientation}
                  onChange={handleChange}
                >
                  <option value="">Select orientation (optional)</option>
                  <option value="heterosexual">Heterosexual/Straight</option>
                  <option value="gay">Gay</option>
                  <option value="lesbian">Lesbian</option>
                  <option value="bisexual">Bisexual</option>
                  <option value="pansexual">Pansexual</option>
                  <option value="asexual">Asexual</option>
                  <option value="demisexual">Demisexual</option>
                  <option value="queer">Queer</option>
                  <option value="questioning">Questioning</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Relationship Status</label>
                <select
                  name="relationshipStatus"
                  value={formData.relationshipStatus}
                  onChange={handleChange}
                >
                  <option value="">Select status (optional)</option>
                  <option value="single">Single</option>
                  <option value="in_relationship">In a Relationship</option>
                  <option value="engaged">Engaged</option>
                  <option value="married">Married</option>
                  <option value="complicated">It's Complicated</option>
                  <option value="open">Open Relationship</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div className="form-group">
                <label>Birthday <span className="info-text">(Only age shows on profile)</span></label>
                <input
                  type="date"
                  name="birthday"
                  value={formData.birthday}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="Write about yourself..."
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label>Location <span className="info-text">(Only city/town shows on profile)</span></label>
                <input
                  type="text"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleChange}
                  placeholder="Enter your postcode"
                />
                {formData.postcode && (
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City/Town"
                    className="mt-2"
                  />
                )}
              </div>

              <div className="form-group">
                <label>Website</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </section>

            {/* Social Links */}
            <section className="form-section">
              <h3>🔗 Social Links</h3>
              <p className="section-description">Add unlimited social media links to your profile</p>

              <div className="social-links-list">
                {formData.socialLinks.map((link, index) => (
                  <div key={index} className="social-link-item">
                    <div className="social-link-info">
                      <strong>{link.platform}</strong>
                      <a href={link.url} target="_blank" rel="noopener noreferrer">{link.url}</a>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSocialLink(index)}
                      className="btn-remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="add-social-link">
                <input
                  type="text"
                  value={newSocialLink.platform}
                  onChange={(e) => setNewSocialLink(prev => ({ ...prev, platform: e.target.value }))}
                  placeholder="Platform (e.g., Instagram, Twitter)"
                />
                <input
                  type="url"
                  value={newSocialLink.url}
                  onChange={(e) => setNewSocialLink(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="URL"
                />
                <button
                  type="button"
                  onClick={handleAddSocialLink}
                  className="btn-add"
                >
                  + Add Link
                </button>
              </div>
            </section>

            {/* Community Preferences */}
            <section className="form-section">
              <h3>🌈 Community Preferences</h3>

              <div className="form-group">
                <label>Interests / Tags</label>
                <div className="tags-container">
                  {formData.interests.map((interest, index) => (
                    <span key={index} className="tag">
                      {interest}
                      <button
                        type="button"
                        onClick={() => handleRemoveInterest(interest)}
                        className="tag-remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="add-tag">
                  <input
                    type="text"
                    value={newInterest}
                    onChange={(e) => setNewInterest(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddInterest())}
                    placeholder="Add an interest..."
                  />
                  <button
                    type="button"
                    onClick={handleAddInterest}
                    className="btn-add"
                  >
                    + Add
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Looking For</label>
                <div className="checkbox-group">
                  {['Friends', 'Support', 'Community', 'Networking'].map(option => (
                    <label key={option} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.lookingFor.includes(option.toLowerCase())}
                        onChange={() => toggleLookingFor(option.toLowerCase())}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* Accessibility & Communication */}
            <section className="form-section">
              <h3>♿ Accessibility & Communication</h3>

              <div className="form-group">
                <label>Preferred Communication Style</label>
                <textarea
                  name="communicationStyle"
                  value={formData.communicationStyle}
                  onChange={handleChange}
                  placeholder="e.g., Direct, Casual, Formal..."
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Safety/Preferences</label>
                <textarea
                  name="safetyPreferences"
                  value={formData.safetyPreferences}
                  onChange={handleChange}
                  placeholder="Any safety preferences or boundaries you'd like to share..."
                  rows="3"
                />
              </div>
            </section>
          </div>

          <div className="form-footer">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-save">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfileModal;


