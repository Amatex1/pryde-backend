import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ReportModal from '../components/ReportModal';
import PhotoViewer from '../components/PhotoViewer';
import Toast from '../components/Toast';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import { useToast } from '../hooks/useToast';
import './Profile.css';

function Profile({ onOpenMiniChat }) {
  const { id } = useParams();
  const currentUser = getCurrentUser();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [uploadMessage, setUploadMessage] = useState('');
  const [friendStatus, setFriendStatus] = useState(null); // null, 'friends', 'pending_sent', 'pending_received', 'none'
  const [friendRequestId, setFriendRequestId] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [reportModal, setReportModal] = useState({ isOpen: false, type: '', contentId: null, userId: null });
  const [photoViewerImage, setPhotoViewerImage] = useState(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const { toasts, showToast, removeToast } = useToast();
  const actionsMenuRef = useRef(null);
  const isOwnProfile = currentUser?.id === id;

  useEffect(() => {
    fetchUserProfile();
    fetchUserPosts();
    if (!isOwnProfile) {
      checkFriendStatus();
      checkBlockStatus();
    }
  }, [id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    };

    if (showActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionsMenu]);

  const checkBlockStatus = async () => {
    try {
      const response = await api.get(`/blocks/check/${id}`);
      setIsBlocked(response.data.isBlocked);
    } catch (error) {
      console.error('Failed to check block status:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await api.get(`/users/${id}`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkFriendStatus = async () => {
    try {
      // Check if already friends
      const friendsResponse = await api.get('/friends');
      const isFriend = friendsResponse.data.some(friend => friend._id === id);

      if (isFriend) {
        setFriendStatus('friends');
        return;
      }

      // Check for pending requests
      const pendingResponse = await api.get('/friends/requests/pending');
      const receivedRequest = pendingResponse.data.find(req => req.sender._id === id);

      if (receivedRequest) {
        setFriendStatus('pending_received');
        setFriendRequestId(receivedRequest._id);
        return;
      }

      // Check for sent requests (we need to check if we sent a request to this user)
      // The backend doesn't have a route for this, so we'll try to send and catch the error
      setFriendStatus('none');
    } catch (error) {
      console.error('Failed to check friend status:', error);
      setFriendStatus('none');
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
      setUploadMessage(`${type === 'profile' ? 'Profile' : 'Cover'} photo updated!`);
      setTimeout(() => setUploadMessage(''), 3000);
      fetchUserProfile();
    } catch (error) {
      setUploadMessage('Failed to upload photo');
      setTimeout(() => setUploadMessage(''), 3000);
      console.error('Upload error:', error);
    }
  };

  const handleAddFriend = async () => {
    try {
      await api.post(`/friends/request/${id}`);
      setFriendStatus('pending_sent');
      showToast('Friend request sent! 🎉', 'success');
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to send friend request', 'error');
    }
  };

  const handleAcceptFriend = async () => {
    try {
      await api.post(`/friends/accept/${friendRequestId}`);
      setFriendStatus('friends');
      fetchUserProfile(); // Refresh to update friend count
      showToast('Friend request accepted! 🎉', 'success');
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to accept friend request', 'error');
    }
  };

  const handleRemoveFriend = async () => {
    if (!window.confirm('Are you sure you want to remove this friend?')) {
      return;
    }

    try {
      await api.delete(`/friends/${id}`);
      setFriendStatus('none');
      fetchUserProfile(); // Refresh to update friend count
      alert('Friend removed');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to remove friend');
    }
  };

  const handleBlockUser = async () => {
    if (!window.confirm('Are you sure you want to block this user? They will not be able to see your content or contact you.')) {
      return;
    }

    try {
      await api.post('/blocks', { blockedUserId: id });
      setIsBlocked(true);
      alert('User blocked successfully');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to block user');
    }
  };

  const handleUnblockUser = async () => {
    if (!window.confirm('Are you sure you want to unblock this user?')) {
      return;
    }

    try {
      await api.delete(`/blocks/${id}`);
      setIsBlocked(false);
      alert('User unblocked successfully');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to unblock user');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar onOpenMiniChat={onOpenMiniChat} />
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-container">
        <Navbar onOpenMiniChat={onOpenMiniChat} />
        <div className="error">User not found</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar onOpenMiniChat={onOpenMiniChat} />
      
      <div className="profile-container">
        <div className="profile-header glossy fade-in">
          <div className="cover-photo">
            {user.coverPhoto ? (
              <img
                src={getImageUrl(user.coverPhoto)}
                alt="Cover"
                onClick={() => setPhotoViewerImage(getImageUrl(user.coverPhoto))}
                style={{ cursor: 'pointer' }}
              />
            ) : (
              <div className="cover-placeholder shimmer"></div>
            )}
          </div>

          <div className="profile-info">
            <div className="profile-avatar">
              {user.profilePhoto ? (
                <img
                  src={getImageUrl(user.profilePhoto)}
                  alt={user.username}
                  onClick={() => setPhotoViewerImage(getImageUrl(user.profilePhoto))}
                  style={{ cursor: 'pointer' }}
                />
              ) : (
                <span>{user.displayName?.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="profile-details">
              <h1 className="profile-name text-shadow">
                {user.displayName || user.fullName || user.username}
                {user.nickname && <span className="nickname"> "{user.nickname}"</span>}
              </h1>
              <p className="profile-username">@{user.username}</p>

              <div className="profile-badges">
                {user.pronouns && user.pronouns !== 'Prefer Not to Say' && (
                  <span className="badge">
                    {user.pronouns === 'Custom' ? user.customPronouns : user.pronouns}
                  </span>
                )}
                {user.gender && user.gender !== 'Prefer Not to Say' && (
                  <span className="badge">
                    {user.gender === 'Custom' ? user.customGender : user.gender}
                  </span>
                )}
                {user.relationshipStatus && user.relationshipStatus !== 'Prefer Not to Say' && (
                  <span className="badge">
                    {user.relationshipStatus === 'Single' && '💔'}
                    {user.relationshipStatus === 'Taken' && '💕'}
                    {user.relationshipStatus === 'Married' && '💍'}
                    {user.relationshipStatus === "It's Complicated" && '😅'}
                    {user.relationshipStatus === 'Looking for Friends' && '👋'}
                    {' '}{user.relationshipStatus}
                  </span>
                )}
              </div>

              {user.bio && <p className="profile-bio">{user.bio}</p>}

              {!isOwnProfile && (
                <div className="profile-action-buttons">
                  <div className="friend-actions">
                    {friendStatus === 'none' && (
                      <button className="btn-add-friend" onClick={handleAddFriend}>
                        ➕ Add Friend
                      </button>
                    )}
                    {friendStatus === 'pending_sent' && (
                      <button className="btn-add-friend" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                        ⏳ Request Sent
                      </button>
                    )}
                    {friendStatus === 'pending_received' && (
                      <button className="btn-add-friend" onClick={handleAcceptFriend}>
                        ✅ Accept Friend Request
                      </button>
                    )}
                    {friendStatus === 'friends' && (
                      <button className="btn-add-friend" onClick={handleRemoveFriend} style={{ background: 'var(--soft-lavender)', color: 'var(--pryde-purple)' }}>
                        ✓ Friends
                      </button>
                    )}
                  </div>

                  <div className="profile-actions-dropdown" ref={actionsMenuRef}>
                    <button
                      className="btn-actions-menu"
                      onClick={() => setShowActionsMenu(!showActionsMenu)}
                    >
                      ⋮
                    </button>
                    {showActionsMenu && (
                      <div className="actions-dropdown-menu">
                        {isBlocked ? (
                          <button className="dropdown-item" onClick={() => { handleUnblockUser(); setShowActionsMenu(false); }}>
                            🔓 Unblock User
                          </button>
                        ) : (
                          <button className="dropdown-item" onClick={() => { handleBlockUser(); setShowActionsMenu(false); }}>
                            🚫 Block User
                          </button>
                        )}
                        <button
                          className="dropdown-item dropdown-item-danger"
                          onClick={() => { setReportModal({ isOpen: true, type: 'user', contentId: null, userId: id }); setShowActionsMenu(false); }}
                        >
                          🚩 Report User
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="profile-meta">
                {user.location && (
                  <span className="meta-item">📍 {user.location}</span>
                )}
                {user.website && (
                  <a href={user.website} target="_blank" rel="noopener noreferrer" className="meta-item">
                    🔗 {user.website}
                  </a>
                )}
              </div>

              {user.socialLinks && user.socialLinks.length > 0 && (
                <div className="social-links">
                  <h3 className="social-title">Social Links</h3>
                  <div className="social-grid">
                    {user.socialLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-link-item glossy"
                      >
                        <span className="social-platform">{link.platform}</span>
                        <span className="social-icon">→</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {isOwnProfile && (
                <div className="profile-upload-section">
                  {uploadMessage && (
                    <div className="upload-message">{uploadMessage}</div>
                  )}
                  <label htmlFor="profile-photo-upload" className="btn-upload">
                    📷 Update Profile Photo
                    <input
                      type="file"
                      id="profile-photo-upload"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'profile')}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <label htmlFor="cover-photo-upload" className="btn-upload">
                    🖼️ Update Cover Photo
                    <input
                      type="file"
                      id="cover-photo-upload"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'cover')}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              )}

              <div className="profile-stats">
                <div className="stat-item">
                  <span className="stat-value">{user.friends?.length || 0}</span>
                  <span className="stat-label">Friends</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">0</span>
                  <span className="stat-label">Posts</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-content">
          <div className="profile-posts">
            <h2 className="section-title">Posts</h2>
            <div className="empty-state glossy">
              <p>No posts yet</p>
            </div>
          </div>

          <div className="profile-sidebar">
            <div className="sidebar-card glossy">
              <h3 className="sidebar-title">Friends</h3>
              {user.friends && user.friends.length > 0 ? (
                <div className="friends-grid">
                  {user.friends.slice(0, 6).map((friend) => (
                    <div key={friend._id} className="friend-item">
                      <div className="friend-avatar">
                        {friend.profilePhoto ? (
                          <img src={getImageUrl(friend.profilePhoto)} alt={friend.username} />
                        ) : (
                          <span>{friend.displayName?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="friend-name">{friend.displayName}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-text">No friends yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ReportModal
        isOpen={reportModal.isOpen}
        onClose={() => setReportModal({ isOpen: false, type: '', contentId: null, userId: null })}
        reportType={reportModal.type}
        contentId={reportModal.contentId}
        userId={reportModal.userId}
      />

      {photoViewerImage && (
        <PhotoViewer
          imageUrl={photoViewerImage}
          onClose={() => setPhotoViewerImage(null)}
        />
      )}

      {/* Toast Notifications */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

export default Profile;
