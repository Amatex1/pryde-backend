import { useState, useEffect, useRef } from 'react';
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
    customPronouns: '',
    gender: '',
    customGender: '',
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

  // Photo positioning and zoom state
  const [coverPos, setCoverPos] = useState({ x: 0, y: 0, scale: 1 });
  const [avatarPos, setAvatarPos] = useState({ x: 0, y: 0, scale: 1 });
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const coverPreviewRef = useRef(null);
  const avatarPreviewRef = useRef(null);

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        fullName: user.fullName || '',
        nickname: user.nickname || '',
        displayNameType: user.displayNameType || 'fullName',
        customDisplayName: user.customDisplayName || '',
        pronouns: user.pronouns || '',
        customPronouns: user.customPronouns || '',
        gender: user.gender || '',
        customGender: user.customGender || '',
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
        profilePhoto: user.profilePhoto || null,
        coverPhoto: user.coverPhoto || null
      });

      // Initialize photo positions from user data
      setCoverPos({
        x: user.coverPhotoPosition?.x || 0,
        y: user.coverPhotoPosition?.y || 0,
        scale: user.coverPhotoPosition?.scale || 1
      });
      setAvatarPos({
        x: user.profilePhotoPosition?.x || 0,
        y: user.profilePhotoPosition?.y || 0,
        scale: user.profilePhotoPosition?.scale || 1
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

  // Drag handlers for cover photo
  const startCoverDrag = (e) => {
    e.preventDefault();
    setIsDraggingCover(true);
    setDragStart({ x: e.clientX - coverPos.x, y: e.clientY - coverPos.y });
  };

  const handleCoverDrag = (e) => {
    if (!isDraggingCover) return;
    e.preventDefault();
    setCoverPos(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const endCoverDrag = () => {
    setIsDraggingCover(false);
  };

  // Drag handlers for avatar photo
  const startAvatarDrag = (e) => {
    e.preventDefault();
    setIsDraggingAvatar(true);
    setDragStart({ x: e.clientX - avatarPos.x, y: e.clientY - avatarPos.y });
  };

  const handleAvatarDrag = (e) => {
    if (!isDraggingAvatar) return;
    e.preventDefault();
    setAvatarPos(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const endAvatarDrag = () => {
    setIsDraggingAvatar(false);
  };

  // Global mouse event listeners for dragging
  useEffect(() => {
    if (isDraggingCover) {
      window.addEventListener('mousemove', handleCoverDrag);
      window.addEventListener('mouseup', endCoverDrag);
      return () => {
        window.removeEventListener('mousemove', handleCoverDrag);
        window.removeEventListener('mouseup', endCoverDrag);
      };
    }
  }, [isDraggingCover, dragStart, coverPos]);

  useEffect(() => {
    if (isDraggingAvatar) {
      window.addEventListener('mousemove', handleAvatarDrag);
      window.addEventListener('mouseup', endAvatarDrag);
      return () => {
        window.removeEventListener('mousemove', handleAvatarDrag);
        window.removeEventListener('mouseup', endAvatarDrag);
      };
    }
  }, [isDraggingAvatar, dragStart, avatarPos]);

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
        // Reset avatar position for new photo
        setAvatarPos({ x: 0, y: 0, scale: 1 });
      } else {
        setFormData(prev => ({ ...prev, coverPhoto: response.data.url }));
        // Reset cover position for new photo
        setCoverPos({ x: 0, y: 0, scale: 1 });
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
      // Include photo URLs and position metadata in the update
      // formData already contains profilePhoto and coverPhoto from user or upload
      const updateData = {
        ...formData,
        coverPhotoPosition: coverPos,
        profilePhotoPosition: avatarPos
      };

      const response = await api.put('/users/profile', updateData);
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

              <div className="photo-editors">
                {/* Cover Photo Editor */}
                <div className="photo-editor-item">
                  <label>Cover Photo</label>
                  <div className="photo-editor-container">
                    <div
                      ref={coverPreviewRef}
                      className="photo-preview-interactive cover"
                      onMouseDown={startCoverDrag}
                      style={{
                        cursor: isDraggingCover ? 'grabbing' : 'grab',
                        overflow: 'hidden',
                        position: 'relative',
                        userSelect: 'none'
                      }}
                    >
                      {formData.coverPhoto || user?.coverPhoto ? (
                        <div
                          style={{
                            backgroundImage: `url(${getImageUrl(formData.coverPhoto || user.coverPhoto)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            width: '100%',
                            height: '100%',
                            transform: `translate(${coverPos.x}px, ${coverPos.y}px) scale(${coverPos.scale})`,
                            transformOrigin: 'center',
                            transition: isDraggingCover ? 'none' : 'transform 0.1s ease'
                          }}
                        />
                      ) : (
                        <div className="photo-placeholder">No cover photo</div>
                      )}
                    </div>
                    <div className="photo-controls">
                      <label htmlFor="cover-zoom">Zoom: {coverPos.scale.toFixed(2)}x</label>
                      <input
                        id="cover-zoom"
                        type="range"
                        min="1"
                        max="2"
                        step="0.01"
                        value={coverPos.scale}
                        onChange={(e) => setCoverPos({ ...coverPos, scale: parseFloat(e.target.value) })}
                        className="zoom-slider"
                      />
                      <input
                        type="file"
                        id="cover-photo-upload"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'cover')}
                        disabled={uploadingPhoto}
                        style={{ marginTop: '8px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Profile Photo Editor */}
                <div className="photo-editor-item">
                  <label>Profile Photo</label>
                  <div className="photo-editor-container">
                    <div
                      ref={avatarPreviewRef}
                      className="photo-preview-interactive avatar"
                      onMouseDown={startAvatarDrag}
                      style={{
                        cursor: isDraggingAvatar ? 'grabbing' : 'grab',
                        overflow: 'hidden',
                        position: 'relative',
                        userSelect: 'none',
                        borderRadius: '50%'
                      }}
                    >
                      {formData.profilePhoto || user?.profilePhoto ? (
                        <div
                          style={{
                            backgroundImage: `url(${getImageUrl(formData.profilePhoto || user.profilePhoto)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            width: '100%',
                            height: '100%',
                            transform: `translate(${avatarPos.x}px, ${avatarPos.y}px) scale(${avatarPos.scale})`,
                            transformOrigin: 'center',
                            transition: isDraggingAvatar ? 'none' : 'transform 0.1s ease'
                          }}
                        />
                      ) : (
                        <div className="photo-placeholder">No photo</div>
                      )}
                    </div>
                    <div className="photo-controls">
                      <label htmlFor="avatar-zoom">Zoom: {avatarPos.scale.toFixed(2)}x</label>
                      <input
                        id="avatar-zoom"
                        type="range"
                        min="1"
                        max="2"
                        step="0.01"
                        value={avatarPos.scale}
                        onChange={(e) => setAvatarPos({ ...avatarPos, scale: parseFloat(e.target.value) })}
                        className="zoom-slider"
                      />
                      <input
                        type="file"
                        id="profile-photo-upload"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, 'profile')}
                        disabled={uploadingPhoto}
                        style={{ marginTop: '8px' }}
                      />
                    </div>
                  </div>
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
                <select
                  name="pronouns"
                  value={formData.pronouns}
                  onChange={handleChange}
                >
                  <option value="">Select Pronouns (Optional)</option>
                  <option value="She/Her">She/Her</option>
                  <option value="He/Him">He/Him</option>
                  <option value="They/Them">They/Them</option>
                  <option value="She/They">She/They</option>
                  <option value="He/They">He/They</option>
                  <option value="Any Pronouns">Any Pronouns</option>
                  <option value="Ask Me">Ask Me</option>
                  <option value="Ze/Zir">Ze/Zir</option>
                  <option value="Xe/Xem">Xe/Xem</option>
                  <option value="Prefer Not to Say">Prefer Not to Say</option>
                  <option value="custom">Custom (type below)</option>
                </select>
                {formData.pronouns === 'custom' && (
                  <input
                    type="text"
                    name="customPronouns"
                    value={formData.customPronouns || ''}
                    onChange={(e) => setFormData({...formData, customPronouns: e.target.value, pronouns: e.target.value})}
                    placeholder="Enter your pronouns"
                    className="mt-2"
                  />
                )}
              </div>

              <div className="form-group">
                <label>Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="">Select Gender (Optional)</option>
                  <option value="Woman">Woman</option>
                  <option value="Man">Man</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Genderqueer">Genderqueer</option>
                  <option value="Genderfluid">Genderfluid</option>
                  <option value="Agender">Agender</option>
                  <option value="Bigender">Bigender</option>
                  <option value="Two-Spirit">Two-Spirit</option>
                  <option value="Transgender Woman">Transgender Woman</option>
                  <option value="Transgender Man">Transgender Man</option>
                  <option value="Questioning">Questioning</option>
                  <option value="Prefer Not to Say">Prefer Not to Say</option>
                  <option value="custom">Custom (type below)</option>
                </select>
                {formData.gender === 'custom' && (
                  <input
                    type="text"
                    name="customGender"
                    value={formData.customGender || ''}
                    onChange={(e) => setFormData({...formData, customGender: e.target.value})}
                    placeholder="Enter your gender"
                    className="mt-2"
                    style={{ marginTop: '0.5rem' }}
                  />
                )}
              </div>

              <div className="form-group">
                <label>Sexual Orientation</label>
                <select
                  name="sexualOrientation"
                  value={formData.sexualOrientation === 'other' || !['', 'heterosexual', 'gay', 'lesbian', 'bisexual', 'pansexual', 'asexual', 'demisexual', 'queer', 'questioning', 'prefer_not_to_say'].includes(formData.sexualOrientation) ? 'other' : formData.sexualOrientation}
                  onChange={handleChange}
                >
                  <option value="">Select Orientation (Optional)</option>
                  <option value="heterosexual">Heterosexual/Straight</option>
                  <option value="gay">Gay</option>
                  <option value="lesbian">Lesbian</option>
                  <option value="bisexual">Bisexual</option>
                  <option value="pansexual">Pansexual</option>
                  <option value="asexual">Asexual</option>
                  <option value="demisexual">Demisexual</option>
                  <option value="queer">Queer</option>
                  <option value="questioning">Questioning</option>
                  <option value="prefer_not_to_say">Prefer Not to Say</option>
                  <option value="other">Other (type below)</option>
                </select>
                {(formData.sexualOrientation === 'other' || !['', 'heterosexual', 'gay', 'lesbian', 'bisexual', 'pansexual', 'asexual', 'demisexual', 'queer', 'questioning', 'prefer_not_to_say'].includes(formData.sexualOrientation)) && (
                  <input
                    type="text"
                    name="sexualOrientation"
                    value={formData.sexualOrientation === 'other' ? '' : formData.sexualOrientation}
                    onChange={(e) => setFormData({...formData, sexualOrientation: e.target.value})}
                    placeholder="Enter your sexual orientation"
                    className="mt-2"
                    style={{ marginTop: '0.5rem' }}
                  />
                )}
              </div>

              <div className="form-group">
                <label>Relationship Status</label>
                <select
                  name="relationshipStatus"
                  value={formData.relationshipStatus}
                  onChange={handleChange}
                >
                  <option value="">Select Status (Optional)</option>
                  <option value="single">Single</option>
                  <option value="in_relationship">In a Relationship</option>
                  <option value="engaged">Engaged</option>
                  <option value="married">Married</option>
                  <option value="domestic_partnership">Domestic Partnership</option>
                  <option value="civil_union">Civil Union</option>
                  <option value="polyamorous">Polyamorous</option>
                  <option value="open">Open Relationship</option>
                  <option value="complicated">It's Complicated</option>
                  <option value="separated">Separated</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                  <option value="prefer_not_to_say">Prefer Not to Say</option>
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
                  <select
                    value={newInterest}
                    onChange={(e) => setNewInterest(e.target.value)}
                    className="interest-dropdown"
                  >
                    <option value="">Select an interest...</option>
                    <optgroup label="Arts & Creativity">
                      <option value="Art">Art</option>
                      <option value="Crafts">Crafts</option>
                      <option value="Dance">Dance</option>
                      <option value="Drawing">Drawing</option>
                      <option value="Fashion">Fashion</option>
                      <option value="Music">Music</option>
                      <option value="Painting">Painting</option>
                      <option value="Photography">Photography</option>
                      <option value="Theater">Theater</option>
                      <option value="Writing">Writing</option>
                    </optgroup>
                    <optgroup label="Entertainment">
                      <option value="Anime">Anime</option>
                      <option value="Comics">Comics</option>
                      <option value="Gaming">Gaming</option>
                      <option value="Movies">Movies</option>
                      <option value="TV Shows">TV Shows</option>
                    </optgroup>
                    <optgroup label="Sports & Fitness">
                      <option value="Basketball">Basketball</option>
                      <option value="Cycling">Cycling</option>
                      <option value="Fitness">Fitness</option>
                      <option value="Football">Football</option>
                      <option value="Hiking">Hiking</option>
                      <option value="Running">Running</option>
                      <option value="Soccer">Soccer</option>
                      <option value="Swimming">Swimming</option>
                      <option value="Yoga">Yoga</option>
                    </optgroup>
                    <optgroup label="Food & Drink">
                      <option value="Baking">Baking</option>
                      <option value="Coffee">Coffee</option>
                      <option value="Cooking">Cooking</option>
                      <option value="Food">Food</option>
                      <option value="Wine">Wine</option>
                    </optgroup>
                    <optgroup label="Technology">
                      <option value="Coding">Coding</option>
                      <option value="Cryptocurrency">Cryptocurrency</option>
                      <option value="Tech">Tech</option>
                      <option value="Web Development">Web Development</option>
                    </optgroup>
                    <optgroup label="Lifestyle">
                      <option value="Books">Books</option>
                      <option value="DIY">DIY</option>
                      <option value="Gardening">Gardening</option>
                      <option value="Meditation">Meditation</option>
                      <option value="Pets">Pets</option>
                      <option value="Travel">Travel</option>
                    </optgroup>
                    <optgroup label="LGBTQ+ Specific">
                      <option value="Activism">Activism</option>
                      <option value="Drag">Drag</option>
                      <option value="LGBTQ+ History">LGBTQ+ History</option>
                      <option value="Pride Events">Pride Events</option>
                      <option value="Queer Culture">Queer Culture</option>
                    </optgroup>
                    <optgroup label="Other">
                      <option value="Astrology">Astrology</option>
                      <option value="Board Games">Board Games</option>
                      <option value="Karaoke">Karaoke</option>
                      <option value="Languages">Languages</option>
                      <option value="Nature">Nature</option>
                      <option value="Podcasts">Podcasts</option>
                      <option value="Science">Science</option>
                      <option value="Volunteering">Volunteering</option>
                    </optgroup>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddInterest}
                    className="btn-add-compact"
                    disabled={!newInterest}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Looking For</label>
                <p className="field-description">Select what you're hoping to find on Pryde Social</p>
                <div className="checkbox-group">
                  <label className="checkbox-label-compact">
                    <input
                      type="checkbox"
                      id="looking-for-friends"
                      name="lookingFor-friends"
                      checked={formData.lookingFor.includes('friends')}
                      onChange={() => toggleLookingFor('friends')}
                    />
                    <span className="checkbox-option-wrapper">
                      <span className="checkbox-option-label">Friends</span>
                      <span className="checkbox-option-helper">Casual connections and people to chat with</span>
                    </span>
                  </label>
                  <label className="checkbox-label-compact">
                    <input
                      type="checkbox"
                      id="looking-for-support"
                      name="lookingFor-support"
                      checked={formData.lookingFor.includes('support')}
                      onChange={() => toggleLookingFor('support')}
                    />
                    <span className="checkbox-option-wrapper">
                      <span className="checkbox-option-label">Support</span>
                      <span className="checkbox-option-helper">Emotional support, understanding, or a safe space</span>
                    </span>
                  </label>
                  <label className="checkbox-label-compact">
                    <input
                      type="checkbox"
                      id="looking-for-community"
                      name="lookingFor-community"
                      checked={formData.lookingFor.includes('community')}
                      onChange={() => toggleLookingFor('community')}
                    />
                    <span className="checkbox-option-wrapper">
                      <span className="checkbox-option-label">Community</span>
                      <span className="checkbox-option-helper">Shared identity, belonging, and group connection</span>
                    </span>
                  </label>
                  <label className="checkbox-label-compact">
                    <input
                      type="checkbox"
                      id="looking-for-networking"
                      name="lookingFor-networking"
                      checked={formData.lookingFor.includes('networking')}
                      onChange={() => toggleLookingFor('networking')}
                    />
                    <span className="checkbox-option-wrapper">
                      <span className="checkbox-option-label">Networking</span>
                      <span className="checkbox-option-helper">Professional, creative, or collaboration connections</span>
                    </span>
                  </label>
                </div>
              </div>
            </section>

            {/* Accessibility & Communication */}
            <section className="form-section">
              <h3>♿ Accessibility & Communication</h3>
              <p className="section-description">Help others understand how to communicate with you best.</p>

              <div className="form-group">
                <label>Preferred Communication Style</label>
                <textarea
                  name="communicationStyle"
                  value={formData.communicationStyle}
                  onChange={handleChange}
                  placeholder="e.g., I prefer direct and clear communication, I may take time to reply, Clear boundaries help me feel safe..."
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Safety/Preferences</label>
                <textarea
                  name="safetyPreferences"
                  value={formData.safetyPreferences}
                  onChange={handleChange}
                  placeholder="e.g., Please avoid sudden topics, I appreciate content warnings, I prefer gentle communication..."
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


