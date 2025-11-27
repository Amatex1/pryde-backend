import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ReportModal from '../components/ReportModal';
import PhotoViewer from '../components/PhotoViewer';
import Toast from '../components/Toast';
import CustomModal from '../components/CustomModal';
import ShareModal from '../components/ShareModal';
import EditProfileModal from '../components/EditProfileModal';
import { useModal } from '../hooks/useModal';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import { useToast } from '../hooks/useToast';
import './Profile.css';

function Profile({ onOpenMiniChat }) {
  const { id } = useParams();
  const currentUser = getCurrentUser();
  const { modalState, closeModal, showAlert, showConfirm } = useModal();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [uploadMessage, setUploadMessage] = useState('');
  const [showCommentBox, setShowCommentBox] = useState({});
  const [commentText, setCommentText] = useState({});
  const [shareModal, setShareModal] = useState({ isOpen: false, post: null });
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [openCommentDropdownId, setOpenCommentDropdownId] = useState(null);
  const commentRefs = useRef({});
  const [showReplies, setShowReplies] = useState({}); // Track which comments have replies visible
  const [showReactionPicker, setShowReactionPicker] = useState(null); // Track which comment shows reaction picker
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [friendStatus, setFriendStatus] = useState(null); // null, 'friends', 'pending_sent', 'pending_received', 'none'
  const [friendRequestId, setFriendRequestId] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [reportModal, setReportModal] = useState({ isOpen: false, type: '', contentId: null, userId: null });
  const [photoViewerImage, setPhotoViewerImage] = useState(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [bookmarkedPosts, setBookmarkedPosts] = useState([]);
  const { toasts, showToast, removeToast } = useToast();
  const actionsMenuRef = useRef(null);
  const isOwnProfile = currentUser?.id === id;
  const [canSendFriendRequest, setCanSendFriendRequest] = useState(true);
  const [canSendMessage, setCanSendMessage] = useState(false);
  const [showUnfriendModal, setShowUnfriendModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPostText, setEditPostText] = useState('');
  const [editPostVisibility, setEditPostVisibility] = useState('friends');

  useEffect(() => {
    fetchUserProfile();
    fetchUserPosts();
    if (!isOwnProfile) {
      checkFriendStatus();
      checkBlockStatus();
      checkPrivacyPermissions();
    }
  }, [id]);

  // Update message permission when friend status changes
  useEffect(() => {
    if (!isOwnProfile && user) {
      checkPrivacyPermissions();
    }
  }, [friendStatus, user]);

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

  const checkPrivacyPermissions = async () => {
    try {
      // Get the user's privacy settings
      const response = await api.get(`/users/${id}`);
      const targetUser = response.data;

      // Check if user can send friend requests
      const friendRequestSetting = targetUser.privacySettings?.whoCanSendFriendRequests || 'everyone';
      if (friendRequestSetting === 'no-one') {
        setCanSendFriendRequest(false);
      } else if (friendRequestSetting === 'friends-of-friends') {
        // This would require checking mutual friends - for now, we'll allow it
        // The backend will validate this when the request is sent
        setCanSendFriendRequest(true);
      } else {
        setCanSendFriendRequest(true);
      }

      // Check if user can send messages
      const messageSetting = targetUser.privacySettings?.whoCanMessage || 'friends';
      if (messageSetting === 'no-one') {
        setCanSendMessage(false);
      } else if (messageSetting === 'friends') {
        // Can only message if friends - will be updated when friendStatus changes
        setCanSendMessage(friendStatus === 'friends');
      } else if (messageSetting === 'everyone') {
        setCanSendMessage(true);
      }
    } catch (error) {
      console.error('Failed to check privacy permissions:', error);
      // Default to allowing if we can't check
      setCanSendFriendRequest(true);
      setCanSendMessage(false);
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

  const fetchUserPosts = async () => {
    try {
      setLoadingPosts(true);
      const response = await api.get(`/posts/user/${id}`);
      setPosts(response.data || []);
    } catch (error) {
      console.error('Failed to fetch user posts:', error);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await api.post(`/posts/${postId}/like`);
      setPosts(posts.map(p => p._id === postId ? response.data : p));
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const handlePostReaction = async (postId, emoji) => {
    try {
      const response = await api.post(`/posts/${postId}/react`, { emoji });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setShowReactionPicker(null); // Hide picker after reaction
    } catch (error) {
      console.error('Failed to react to post:', error);
    }
  };

  const handleCommentReaction = async (postId, commentId, emoji) => {
    try {
      const response = await api.post(`/posts/${postId}/comment/${commentId}/react`, { emoji });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setShowReactionPicker(null); // Hide picker after reaction
    } catch (error) {
      console.error('Failed to react to comment:', error);
    }
  };

  const handleCommentSubmit = async (postId, e) => {
    e.preventDefault();
    const content = commentText[postId];
    if (!content || !content.trim()) return;

    try {
      const response = await api.post(`/posts/${postId}/comment`, { content });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setCommentText(prev => ({ ...prev, [postId]: '' }));
    } catch (error) {
      console.error('Failed to comment:', error);
      showAlert('Failed to add comment. Please try again.', 'Comment Failed');
    }
  };

  const handleCommentChange = (postId, value) => {
    setCommentText(prev => ({ ...prev, [postId]: value }));
  };

  const handleEditComment = (commentId, content) => {
    setEditingCommentId(commentId);
    setEditCommentText(content);
  };

  const handleSaveEditComment = async (postId, commentId) => {
    if (!editCommentText.trim()) return;

    try {
      const response = await api.put(`/posts/${postId}/comment/${commentId}`, {
        content: editCommentText
      });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setEditingCommentId(null);
      setEditCommentText('');
      showToast('Comment updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update comment:', error);
      showToast('Failed to update comment', 'error');
    }
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const handleDeleteComment = async (postId, commentId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this comment?',
      'Delete Comment'
    );

    if (!confirmed) return;

    try {
      const response = await api.delete(`/posts/${postId}/comment/${commentId}`);
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      showToast('Comment deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete comment:', error);
      showToast('Failed to delete comment', 'error');
    }
  };

  const handleReplyToComment = (postId, commentId) => {
    setReplyingToComment({ postId, commentId });
    setReplyText('');
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    const { postId, commentId } = replyingToComment;

    try {
      const response = await api.post(`/posts/${postId}/comment/${commentId}/reply`, {
        content: replyText
      });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setReplyText('');
      setReplyingToComment(null);
      showToast('Reply added successfully', 'success');
    } catch (error) {
      console.error('Failed to add reply:', error);
      showToast('Failed to add reply', 'error');
    }
  };

  const handleCancelReply = () => {
    setReplyingToComment(null);
    setReplyText('');
  };

  const handleShare = (post) => {
    setShareModal({ isOpen: true, post });
  };

  const handleShareComplete = async () => {
    try {
      const response = await api.post(`/posts/${shareModal.post._id}/share`);
      setPosts(posts.map(p => p._id === shareModal.post._id ? response.data : p));
      showAlert('Post shared successfully!', 'Shared');
    } catch (error) {
      console.error('Failed to share post:', error);
      showAlert(error.response?.data?.message || 'Failed to share post.', 'Share Failed');
    }
  };

  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
    showToast('Profile updated successfully!', 'success');
  };

  const toggleDropdown = (postId) => {
    setOpenDropdownId(openDropdownId === postId ? null : postId);
  };

  const handleEditPost = (post) => {
    setEditingPostId(post._id);
    setEditPostText(post.content);
    setEditPostVisibility(post.visibility || 'friends');
    setOpenDropdownId(null);
  };

  const handleSaveEditPost = async (postId) => {
    if (!editPostText.trim()) return;

    try {
      const response = await api.put(`/posts/${postId}`, {
        content: editPostText,
        visibility: editPostVisibility
      });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setEditingPostId(null);
      setEditPostText('');
      setEditPostVisibility('friends');
      showToast('Post updated successfully!', 'success');
    } catch (error) {
      console.error('Failed to edit post:', error);
      showToast('Failed to edit post. Please try again.', 'error');
    }
  };

  const handleCancelEditPost = () => {
    setEditingPostId(null);
    setEditPostText('');
    setEditPostVisibility('friends');
  };

  const handleDeletePost = async (postId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this post?',
      'Delete Post'
    );
    if (!confirmed) return;

    try {
      await api.delete(`/posts/${postId}`);
      setPosts(posts.filter(p => p._id !== postId));
      showToast('Post deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete post:', error);
      showToast('Failed to delete post. Please try again.', 'error');
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

      // Check for pending requests (received)
      const pendingResponse = await api.get('/friends/requests/pending');
      const receivedRequest = pendingResponse.data.find(req => req.sender._id === id);

      if (receivedRequest) {
        setFriendStatus('pending_received');
        setFriendRequestId(receivedRequest._id);
        return;
      }

      // Check for sent requests
      const sentResponse = await api.get('/friends/requests/sent');
      const sentRequest = sentResponse.data.find(req => req.receiver._id === id);

      if (sentRequest) {
        setFriendStatus('pending_sent');
        setFriendRequestId(sentRequest._id); // Store request ID for cancellation
        return;
      }

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

  const handleCancelRequest = async () => {
    try {
      await api.delete(`/friends/request/${friendRequestId}`);
      setFriendStatus('none');
      setFriendRequestId(null);
      showToast('Friend request cancelled', 'success');
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to cancel friend request', 'error');
    }
  };

  const handleRemoveFriend = async () => {
    setShowUnfriendModal(true);
  };

  const confirmUnfriend = async () => {
    try {
      await api.delete(`/friends/${id}`);
      setFriendStatus('none');
      fetchUserProfile(); // Refresh to update friend count
      showToast('Friend removed', 'success');
      setShowUnfriendModal(false);
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to remove friend', 'error');
      setShowUnfriendModal(false);
    }
  };

  const handleMessage = () => {
    if (!canSendMessage) {
      showToast('You cannot message this user due to their privacy settings', 'error');
      return;
    }
    onOpenMiniChat(user);
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
            {/* Edit Profile button in top right of cover photo */}
            {isOwnProfile && (
              <button
                className="btn-edit-profile-cover"
                onClick={() => setEditProfileModal(true)}
                title="Edit Profile"
              >
                ✏️ Edit Profile
              </button>
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
                {user.pronouns && (
                  <span className="badge">
                    {user.pronouns}
                  </span>
                )}
                {user.gender && (
                  <span className="badge">
                    {user.gender}
                  </span>
                )}
                {user.sexualOrientation && (
                  <span className="badge">
                    {user.sexualOrientation}
                  </span>
                )}
                {user.relationshipStatus && (
                  <span className="badge">
                    {user.relationshipStatus === 'single' && '💔'}
                    {user.relationshipStatus === 'in_relationship' && '💕'}
                    {user.relationshipStatus === 'married' && '💍'}
                    {user.relationshipStatus === 'engaged' && '💍'}
                    {user.relationshipStatus === 'complicated' && '😅'}
                    {user.relationshipStatus === 'open' && '🌈'}
                    {' '}{user.relationshipStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                )}
                {user.birthday && (
                  <span className="badge">
                    🎂 {new Date().getFullYear() - new Date(user.birthday).getFullYear()} years old
                  </span>
                )}
                {user.city && (
                  <span className="badge">
                    📍 {user.city}
                  </span>
                )}
              </div>

              {user.bio && <p className="profile-bio">{user.bio}</p>}

              {!isOwnProfile && (
                <div className="profile-action-buttons">
                  <div className="friend-actions">
                    {friendStatus === 'none' && canSendFriendRequest && (
                      <button className="btn-add-friend" onClick={handleAddFriend}>
                        ➕ Add Friend
                      </button>
                    )}
                    {friendStatus === 'none' && !canSendFriendRequest && (
                      <button className="btn-add-friend" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                        🔒 Friend Requests Disabled
                      </button>
                    )}
                    {friendStatus === 'pending_sent' && (
                      <button className="btn-cancel-request" onClick={handleCancelRequest}>
                        ❌ Cancel Request
                      </button>
                    )}
                    {friendStatus === 'pending_received' && (
                      <button className="btn-add-friend" onClick={handleAcceptFriend}>
                        ✅ Accept Friend Request
                      </button>
                    )}
                    {friendStatus === 'friends' && (
                      <button className="btn-unfriend" onClick={handleRemoveFriend}>
                        👥 Unfriend
                      </button>
                    )}

                    {/* Message button - show based on privacy settings */}
                    {canSendMessage && (
                      <button
                        className="btn-message"
                        onClick={handleMessage}
                      >
                        💬 Message
                      </button>
                    )}
                    {!canSendMessage && friendStatus !== 'friends' && (
                      <button
                        className="btn-message"
                        disabled
                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                        title="You must be friends to message this user"
                      >
                        🔒 Message
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
                  <span className="stat-value">{posts.length}</span>
                  <span className="stat-label">Posts</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-content">
          <div className="profile-posts">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="section-title">Posts</h2>
              {isOwnProfile && (
                <Link
                  to="/feed"
                  className="btn-primary"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #6C5CE7 0%, #0984E3 100%)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    textDecoration: 'none',
                    display: 'inline-block'
                  }}
                >
                  ✨ Create Post
                </Link>
              )}
            </div>

            {loadingPosts ? (
              <div className="loading-state">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="empty-state glossy">
                <p>No posts yet</p>
              </div>
            ) : (
              <div className="posts-list">
                {posts.map((post) => {
                  const isLiked = post.likes?.some(like =>
                    (typeof like === 'string' ? like : like._id) === (currentUser?.id || currentUser?._id)
                  );

                  return (
                    <div key={post._id} className="post-card glossy fade-in">
                      <div className="post-header">
                        <div className="post-author">
                          <div className="author-avatar">
                            {post.author?.profilePhoto ? (
                              <img src={getImageUrl(post.author.profilePhoto)} alt={post.author.username} />
                            ) : (
                              <span>{post.author?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                            )}
                          </div>
                          <div className="author-info">
                            <div className="author-name">{post.author?.displayName || post.author?.username}</div>
                            <div className="post-time">
                              {new Date(post.createdAt).toLocaleDateString()}
                              <span className="post-privacy-icon" title={`Visible to: ${post.visibility || 'friends'}`}>
                                {post.visibility === 'public' ? '🌍' : post.visibility === 'private' ? '🔒' : '👥'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="post-header-actions">
                          <div className="post-dropdown-container">
                            <button
                              className="btn-dropdown"
                              onClick={() => toggleDropdown(post._id)}
                              title="More options"
                            >
                              ⋮
                            </button>
                            {openDropdownId === post._id && (
                              <div className="dropdown-menu">
                                {(post.author?._id === currentUser?.id || post.author?._id === currentUser?._id) ? (
                                  <>
                                    {!post.isShared && (
                                      <button
                                        className="dropdown-item"
                                        onClick={() => handleEditPost(post)}
                                      >
                                        ✏️ Edit
                                      </button>
                                    )}
                                    <button
                                      className="dropdown-item delete"
                                      onClick={() => {
                                        handleDeletePost(post._id);
                                        setOpenDropdownId(null);
                                      }}
                                    >
                                      🗑️ Delete
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="dropdown-item report"
                                    onClick={() => {
                                      setReportModal({ isOpen: true, type: 'post', contentId: post._id, userId: post.author?._id });
                                      setOpenDropdownId(null);
                                    }}
                                  >
                                    🚩 Report
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="post-content">
                        {editingPostId === post._id ? (
                          <div className="edit-post-container">
                            <textarea
                              value={editPostText}
                              onChange={(e) => setEditPostText(e.target.value)}
                              className="edit-post-textarea"
                              placeholder="What's on your mind?"
                            />
                            <div className="edit-post-actions">
                              <select
                                value={editPostVisibility}
                                onChange={(e) => setEditPostVisibility(e.target.value)}
                                className="visibility-select"
                              >
                                <option value="public">🌍 Public</option>
                                <option value="friends">👥 Friends</option>
                                <option value="private">🔒 Private</option>
                              </select>
                              <div className="edit-post-buttons">
                                <button
                                  onClick={() => handleSaveEditPost(post._id)}
                                  className="btn-save-edit"
                                >
                                  💾 Save
                                </button>
                                <button
                                  onClick={handleCancelEditPost}
                                  className="btn-cancel-edit"
                                >
                                  ❌ Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Show "X shared X's post" if this is a shared post */}
                            {post.isShared && post.originalPost && (
                              <div style={{
                                marginBottom: '1rem',
                                padding: '0.5rem 0.75rem',
                                background: 'var(--soft-lavender)',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                color: 'var(--text-main)'
                              }}>
                                <strong>{post.author?.displayName || post.author?.username}</strong> shared{' '}
                                <strong>{post.originalPost.author?.displayName || post.originalPost.author?.username}'s</strong> post
                              </div>
                            )}

                            {/* Show share comment if this is a shared post */}
                            {post.isShared && post.shareComment && (
                              <p style={{ marginBottom: '1rem', fontStyle: 'italic' }}>
                                {post.shareComment}
                              </p>
                            )}

                            {/* Show original post if this is a shared post */}
                            {post.isShared && post.originalPost ? (
                              <div className="shared-post-container" style={{
                                border: '2px solid var(--soft-lavender)',
                                borderRadius: '12px',
                                padding: '1rem',
                                marginTop: '0.5rem',
                                background: 'var(--background-light)'
                              }}>
                                <div className="shared-post-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                  <div className="author-avatar" style={{ width: '32px', height: '32px' }}>
                                    {post.originalPost.author?.profilePhoto ? (
                                      <img src={getImageUrl(post.originalPost.author.profilePhoto)} alt={post.originalPost.author.username} />
                                    ) : (
                                      <span>{post.originalPost.author?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                                    )}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                      {post.originalPost.author?.displayName || post.originalPost.author?.username}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                      {new Date(post.originalPost.createdAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                                {post.originalPost.content && <p>{post.originalPost.content}</p>}
                                {post.originalPost.media && post.originalPost.media.length > 0 && (
                                  <div className="post-media">
                                    {post.originalPost.media.map((mediaItem, index) => (
                                      <div key={index} className="media-item">
                                        {mediaItem.type === 'image' ? (
                                          <img
                                            src={getImageUrl(mediaItem.url)}
                                            alt="Shared post media"
                                            onClick={() => setPhotoViewerImage(getImageUrl(mediaItem.url))}
                                            style={{ cursor: 'pointer' }}
                                          />
                                        ) : (
                                          <video controls>
                                            <source src={getImageUrl(mediaItem.url)} type="video/mp4" />
                                          </video>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                {post.content && <p>{post.content}</p>}
                                {post.media && post.media.length > 0 && (
                                  <div className="post-media">
                                    {post.media.map((mediaItem, index) => (
                                      <div key={index} className="media-item">
                                        {mediaItem.type === 'image' ? (
                                          <img
                                            src={getImageUrl(mediaItem.url)}
                                            alt="Post media"
                                            onClick={() => setPhotoViewerImage(getImageUrl(mediaItem.url))}
                                            style={{ cursor: 'pointer' }}
                                          />
                                        ) : (
                                          <video controls>
                                            <source src={getImageUrl(mediaItem.url)} type="video/mp4" />
                                          </video>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>

                      <div className="post-stats">
                        <span>{post.likes?.length || 0} likes</span>
                        <span>{post.comments?.length || 0} comments</span>
                        <span>{post.shares?.length || 0} shares</span>
                      </div>

                      <div className="post-actions">
                        <div className="reaction-container">
                          <button
                            className={`action-btn ${isLiked ? 'liked' : ''}`}
                            onClick={() => handleLike(post._id)}
                            onMouseEnter={() => setShowReactionPicker(`post-${post._id}`)}
                          >
                            {isLiked ? '❤️' : '🤍'} Like
                          </button>
                          {showReactionPicker === `post-${post._id}` && (
                            <div
                              className="reaction-picker"
                              onMouseEnter={() => setShowReactionPicker(`post-${post._id}`)}
                              onMouseLeave={() => setShowReactionPicker(null)}
                            >
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '👍')} title="Like">👍</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '❤️')} title="Love">❤️</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '😂')} title="Haha">😂</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '😮')} title="Wow">😮</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '😢')} title="Sad">😢</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '😡')} title="Angry">😡</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '🤗')} title="Care">🤗</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '🎉')} title="Celebrate">🎉</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '🤔')} title="Think">🤔</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '🔥')} title="Fire">🔥</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '👏')} title="Clap">👏</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '🤯')} title="Mind Blown">🤯</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '🤢')} title="Disgust">🤢</button>
                              <button className="reaction-btn" onClick={() => handlePostReaction(post._id, '👎')} title="Dislike">👎</button>
                            </div>
                          )}
                        </div>
                        <button
                          className="action-btn"
                          onClick={() => setShowCommentBox(prev => ({ ...prev, [post._id]: !prev[post._id] }))}
                        >
                          💬 Comment
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => handleShare(post)}
                        >
                          🔄 Share
                        </button>
                      </div>

                      {/* Comments Display */}
                      {post.comments && post.comments.length > 0 && (
                        <div className="post-comments">
                          {post.comments.filter(comment => !comment.parentComment).slice(-3).map((comment) => {
                            const isEditing = editingCommentId === comment._id;
                            const isOwnComment = comment.user?._id === currentUser?._id;
                            const replies = post.comments.filter(c => c.parentComment === comment._id);

                            return (
                              <div key={comment._id} className="comment-thread">
                                <div
                                  className="comment"
                                  ref={(el) => commentRefs.current[comment._id] = el}
                                >
                                  <Link to={`/profile/${comment.user?._id}`} className="comment-avatar" style={{ textDecoration: 'none' }}>
                                    {comment.user?.profilePhoto ? (
                                      <img src={getImageUrl(comment.user.profilePhoto)} alt={comment.user.username} />
                                    ) : (
                                      <span>{comment.user?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                                    )}
                                  </Link>
                                  <div className="comment-content">
                                    {isEditing ? (
                                      <div className="comment-edit-box">
                                        <input
                                          type="text"
                                          value={editCommentText}
                                          onChange={(e) => setEditCommentText(e.target.value)}
                                          className="comment-edit-input"
                                          autoFocus
                                        />
                                        <div className="comment-edit-actions">
                                          <button
                                            onClick={() => handleSaveEditComment(post._id, comment._id)}
                                            className="btn-save-comment"
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={handleCancelEditComment}
                                            className="btn-cancel-comment"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="comment-header">
                                          <span className="comment-author-name">{comment.user?.displayName || comment.user?.username}</span>
                                        </div>

                                        <div className="comment-text">
                                          {comment.content}
                                          {comment.edited && <span className="edited-indicator"> (edited)</span>}
                                        </div>

                                        {/* YouTube-style actions below comment */}
                                        <div className="comment-actions">
                                          <span className="comment-timestamp">
                                            {(() => {
                                              const now = new Date();
                                              const commentDate = new Date(comment.createdAt);
                                              const diffMs = now - commentDate;
                                              const diffMins = Math.floor(diffMs / 60000);
                                              const diffHours = Math.floor(diffMs / 3600000);
                                              const diffDays = Math.floor(diffMs / 86400000);

                                              if (diffMins < 1) return 'Just now';
                                              if (diffMins < 60) return `${diffMins}m`;
                                              if (diffHours < 24) return `${diffHours}h`;
                                              if (diffDays < 7) return `${diffDays}d`;
                                              return commentDate.toLocaleDateString();
                                            })()}
                                          </span>
                                          <div className="reaction-container">
                                            <button
                                              className="comment-action-btn"
                                              onClick={() => {/* TODO: Add like functionality */}}
                                              onMouseEnter={() => setShowReactionPicker(`comment-${comment._id}`)}
                                            >
                                              👍 Like
                                            </button>
                                            {showReactionPicker === `comment-${comment._id}` && (
                                              <div
                                                className="reaction-picker"
                                                onMouseEnter={() => setShowReactionPicker(`comment-${comment._id}`)}
                                                onMouseLeave={() => setShowReactionPicker(null)}
                                              >
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Like">👍</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Love">❤️</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Haha">😂</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Wow">😮</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Sad">😢</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Angry">😡</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Care">🤗</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Celebrate">🎉</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Think">🤔</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Fire">🔥</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Clap">👏</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Mind Blown">🤯</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Disgust">🤢</button>
                                                <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Dislike">👎</button>
                                              </div>
                                            )}
                                          </div>
                                          <button
                                            className="comment-action-btn"
                                            onClick={() => handleReplyToComment(post._id, comment._id)}
                                          >
                                            💬 Reply
                                          </button>
                                          {replies.length > 0 && (
                                            <button
                                              className="comment-action-btn view-replies-btn"
                                              onClick={() => setShowReplies(prev => ({
                                                ...prev,
                                                [comment._id]: !prev[comment._id]
                                              }))}
                                            >
                                              {showReplies[comment._id] ? '▲' : '▼'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                                            </button>
                                          )}
                                          {isOwnComment ? (
                                            <>
                                              <button
                                                className="comment-action-btn"
                                                onClick={() => handleEditComment(comment._id, comment.content)}
                                              >
                                                ✏️ Edit
                                              </button>
                                              <button
                                                className="comment-action-btn delete-btn"
                                                onClick={() => handleDeleteComment(post._id, comment._id)}
                                              >
                                                🗑️ Delete
                                              </button>
                                            </>
                                          ) : (
                                            <button
                                              className="comment-action-btn"
                                              onClick={() => {
                                                setReportModal({ isOpen: true, type: 'comment', contentId: comment._id, userId: comment.user?._id });
                                              }}
                                            >
                                              🚩 Report
                                            </button>
                                          )}
                                        </div>

                                        {/* Reply Input Box */}
                                        {replyingToComment?.postId === post._id && replyingToComment?.commentId === comment._id && (
                                          <form onSubmit={handleSubmitReply} className="reply-input-box">
                                            <div className="reply-input-wrapper">
                                              <input
                                                type="text"
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder="Write a reply..."
                                                className="reply-input"
                                                autoFocus
                                              />
                                              <div className="reply-actions">
                                                <button type="submit" className="btn-submit-reply" disabled={!replyText.trim()}>
                                                  Send
                                                </button>
                                                <button type="button" onClick={handleCancelReply} className="btn-cancel-reply">
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          </form>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Nested Replies */}
                                {replies.length > 0 && showReplies[comment._id] && (
                                  <div className="comment-replies">
                                    {replies.map((reply) => {
                                      const isOwnReply = reply.user?._id === currentUser?._id;
                                      const isEditingReply = editingCommentId === reply._id;

                                      return (
                                        <div
                                          key={reply._id}
                                          className="comment reply"
                                          ref={(el) => commentRefs.current[reply._id] = el}
                                        >
                                          <Link to={`/profile/${reply.user?._id}`} className="comment-avatar" style={{ textDecoration: 'none' }}>
                                            {reply.user?.profilePhoto ? (
                                              <img src={getImageUrl(reply.user.profilePhoto)} alt={reply.user.username} />
                                            ) : (
                                              <span>{reply.user?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                                            )}
                                          </Link>
                                          <div className="comment-content">
                                            {isEditingReply ? (
                                              <div className="comment-edit-box">
                                                <input
                                                  type="text"
                                                  value={editCommentText}
                                                  onChange={(e) => setEditCommentText(e.target.value)}
                                                  className="comment-edit-input"
                                                  autoFocus
                                                />
                                                <div className="comment-edit-actions">
                                                  <button
                                                    onClick={() => handleSaveEditComment(post._id, reply._id)}
                                                    className="btn-save-comment"
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    onClick={handleCancelEditComment}
                                                    className="btn-cancel-comment"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <>
                                                <div className="comment-header">
                                                  <span className="comment-author-name">{reply.user?.displayName || reply.user?.username}</span>
                                                </div>

                                                <div className="comment-text">
                                                  {reply.content}
                                                  {reply.edited && <span className="edited-indicator"> (edited)</span>}
                                                </div>

                                                {/* YouTube-style actions below reply */}
                                                <div className="comment-actions">
                                                  <span className="comment-timestamp">
                                                    {(() => {
                                                      const now = new Date();
                                                      const replyDate = new Date(reply.createdAt);
                                                      const diffMs = now - replyDate;
                                                      const diffMins = Math.floor(diffMs / 60000);
                                                      const diffHours = Math.floor(diffMs / 3600000);
                                                      const diffDays = Math.floor(diffMs / 86400000);

                                                      if (diffMins < 1) return 'Just now';
                                                      if (diffMins < 60) return `${diffMins}m`;
                                                      if (diffHours < 24) return `${diffHours}h`;
                                                      if (diffDays < 7) return `${diffDays}d`;
                                                      return replyDate.toLocaleDateString();
                                                    })()}
                                                  </span>
                                                  <div className="reaction-container">
                                                    <button
                                                      className="comment-action-btn"
                                                      onClick={() => {/* TODO: Add like functionality */}}
                                                      onMouseEnter={() => setShowReactionPicker(`reply-${reply._id}`)}
                                                    >
                                                      👍 Like
                                                    </button>
                                                    {showReactionPicker === `reply-${reply._id}` && (
                                                      <div
                                                        className="reaction-picker"
                                                        onMouseEnter={() => setShowReactionPicker(`reply-${reply._id}`)}
                                                        onMouseLeave={() => setShowReactionPicker(null)}
                                                      >
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Like">👍</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Love">❤️</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Haha">😂</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Wow">😮</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Sad">😢</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Angry">😡</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Care">🤗</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Celebrate">🎉</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Think">🤔</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Fire">🔥</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Clap">👏</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Mind Blown">🤯</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Disgust">🤢</button>
                                                        <button className="reaction-btn" onClick={() => {/* TODO: Add reaction */}} title="Dislike">👎</button>
                                                      </div>
                                                    )}
                                                  </div>
                                                  <button
                                                    className="comment-action-btn"
                                                    onClick={() => handleReplyToComment(post._id, comment._id)}
                                                  >
                                                    💬 Reply
                                                  </button>
                                                  {isOwnReply ? (
                                                    <>
                                                      <button
                                                        className="comment-action-btn"
                                                        onClick={() => handleEditComment(reply._id, reply.content)}
                                                      >
                                                        ✏️ Edit
                                                      </button>
                                                      <button
                                                        className="comment-action-btn delete-btn"
                                                        onClick={() => handleDeleteComment(post._id, reply._id)}
                                                      >
                                                        🗑️ Delete
                                                      </button>
                                                    </>
                                                  ) : (
                                                    <button
                                                      className="comment-action-btn"
                                                      onClick={() => {
                                                        setReportModal({ isOpen: true, type: 'comment', contentId: reply._id, userId: reply.user?._id });
                                                      }}
                                                    >
                                                      🚩 Report
                                                    </button>
                                                  )}
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Comment Input Box */}
                      {showCommentBox[post._id] && (
                        <form onSubmit={(e) => handleCommentSubmit(post._id, e)} className="comment-input-box">
                          <div className="comment-input-wrapper">
                            <div className="comment-user-avatar">
                              {currentUser?.profilePhoto ? (
                                <img src={getImageUrl(currentUser.profilePhoto)} alt="You" />
                              ) : (
                                <span>{currentUser?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={commentText[post._id] || ''}
                              onChange={(e) => handleCommentChange(post._id, e.target.value)}
                              placeholder="Write a comment..."
                              className="comment-input glossy"
                            />
                            <button
                              type="submit"
                              className="comment-submit-btn"
                              disabled={!commentText[post._id]?.trim()}
                            >
                              ➤
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="profile-sidebar">
            {/* Interests */}
            {user.interests && user.interests.length > 0 && (
              <div className="sidebar-card glossy">
                <h3 className="sidebar-title">🏷️ Interests</h3>
                <div className="interests-tags">
                  {user.interests.map((interest, index) => (
                    <span key={index} className="interest-tag">{interest}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Looking For */}
            {user.lookingFor && user.lookingFor.length > 0 && (
              <div className="sidebar-card glossy">
                <h3 className="sidebar-title">🔍 Looking For</h3>
                <div className="looking-for-list">
                  {user.lookingFor.map((item, index) => (
                    <span key={index} className="looking-for-item">
                      {item === 'friends' && '👥 Friends'}
                      {item === 'support' && '🤝 Support'}
                      {item === 'community' && '🌈 Community'}
                      {item === 'networking' && '💼 Networking'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Social Links */}
            {user.socialLinks && user.socialLinks.length > 0 && (
              <div className="sidebar-card glossy">
                <h3 className="sidebar-title">🔗 Social Links</h3>
                <div className="social-links-list">
                  {user.socialLinks.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-link"
                    >
                      <strong>{link.platform}</strong>
                      <span className="link-arrow">→</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Website */}
            {user.website && (
              <div className="sidebar-card glossy">
                <h3 className="sidebar-title">🌐 Website</h3>
                <a
                  href={user.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="website-link"
                >
                  {user.website}
                </a>
              </div>
            )}

            <div className="sidebar-card glossy">
              <h3 className="sidebar-title">Friends</h3>
              {user.friends && user.friends.length > 0 ? (
                <div className="friends-grid">
                  {user.friends.slice(0, 6).map((friend) => (
                    <Link key={friend._id} to={`/profile/${friend._id}`} className="friend-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="friend-avatar">
                        {friend.profilePhoto ? (
                          <img src={getImageUrl(friend.profilePhoto)} alt={friend.username} />
                        ) : (
                          <span>{friend.displayName?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="friend-name">{friend.displayName}</div>
                    </Link>
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

      <ShareModal
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal({ isOpen: false, post: null })}
        post={shareModal.post}
        onShare={handleShareComplete}
      />

      <EditProfileModal
        isOpen={editProfileModal}
        onClose={() => setEditProfileModal(false)}
        user={user}
        onUpdate={handleProfileUpdate}
      />

      {/* Unfriend Confirmation Modal */}
      {showUnfriendModal && (
        <CustomModal
          isOpen={showUnfriendModal}
          onClose={() => setShowUnfriendModal(false)}
          title="Unfriend User"
        >
          <div style={{ padding: '1rem' }}>
            <p style={{ marginBottom: '1.5rem', fontSize: '1rem', lineHeight: '1.6' }}>
              Are you sure you want to unfriend <strong>{user?.displayName || user?.username}</strong>?
            </p>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              You will need to send a new friend request to connect again.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowUnfriendModal(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  border: '2px solid var(--border-light)',
                  background: 'transparent',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmUnfriend}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#e74c3c',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
              >
                Unfriend
              </button>
            </div>
          </div>
        </CustomModal>
      )}
    </div>
  );
}

export default Profile;
