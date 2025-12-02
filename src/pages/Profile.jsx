import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ReportModal from '../components/ReportModal';
import PhotoViewer from '../components/PhotoViewer';
import Toast from '../components/Toast';
import CustomModal from '../components/CustomModal';
import ShareModal from '../components/ShareModal';
import EditProfileModal from '../components/EditProfileModal';
import ReactionDetailsModal from '../components/ReactionDetailsModal';
import FormattedText from '../components/FormattedText';
import ProfileSkeleton from '../components/ProfileSkeleton';
import PostSkeleton from '../components/PostSkeleton';
import { useModal } from '../hooks/useModal';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import { useToast } from '../hooks/useToast';
import { convertEmojiShortcuts } from '../utils/textFormatting';
import './Profile.css';

function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  // New follow system states
  const [followStatus, setFollowStatus] = useState(null); // null, 'following', 'pending', 'none'
  const [followRequestId, setFollowRequestId] = useState(null);
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  // OPTIONAL FEATURES: Creator profile tabs
  const [activeTab, setActiveTab] = useState('posts');
  const [journals, setJournals] = useState([]);
  const [longformPosts, setLongformPosts] = useState([]);
  const [photoEssays, setPhotoEssays] = useState([]);
  const [reportModal, setReportModal] = useState({ isOpen: false, type: '', contentId: null, userId: null });
  const [photoViewerImage, setPhotoViewerImage] = useState(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [postVisibility, setPostVisibility] = useState('followers');
  const [contentWarning, setContentWarning] = useState('');
  const [showContentWarning, setShowContentWarning] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [bookmarkedPosts, setBookmarkedPosts] = useState([]);
  const { toasts, showToast, removeToast } = useToast();
  const actionsMenuRef = useRef(null);
  const isOwnProfile = currentUser?.username === id;
  const [canSendFriendRequest, setCanSendFriendRequest] = useState(true);
  const [canSendMessage, setCanSendMessage] = useState(false);
  const [showUnfriendModal, setShowUnfriendModal] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPostText, setEditPostText] = useState('');
  const [editPostVisibility, setEditPostVisibility] = useState('friends');
  const [reactionDetailsModal, setReactionDetailsModal] = useState({ isOpen: false, reactions: [], likes: [] });
  const editTextareaRef = useRef(null);

  useEffect(() => {
    fetchUserProfile();
    fetchUserPosts();
    if (!isOwnProfile) {
      checkFriendStatus();
      checkFollowStatus(); // Check follow status for new system
      checkBlockStatus();
      checkPrivacyPermissions();
    }
  }, [id]);

  // Auto-resize edit textarea based on content
  useEffect(() => {
    if (editTextareaRef.current && editingPostId) {
      const textarea = editTextareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(textarea.scrollHeight, 100) + 'px';
    }
  }, [editPostText, editingPostId]);

  // OPTIONAL FEATURES: Fetch content when tab changes
  useEffect(() => {
    if (activeTab === 'journals') {
      fetchJournals();
    } else if (activeTab === 'longform') {
      fetchLongformPosts();
    } else if (activeTab === 'photoEssays') {
      fetchPhotoEssays();
    }
  }, [activeTab, id]);

  // Update message permission when friend/follow status changes
  useEffect(() => {
    if (!isOwnProfile && user) {
      checkPrivacyPermissions();
    }
  }, [friendStatus, followStatus, user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
      // Close reaction picker when clicking outside
      if (!event.target.closest('.reaction-container')) {
        setShowReactionPicker(null);
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
      const messageSetting = targetUser.privacySettings?.whoCanMessage || 'followers';
      if (messageSetting === 'no-one') {
        setCanSendMessage(false);
      } else if (messageSetting === 'friends' || messageSetting === 'followers') {
        // Can only message if following (or friends for backward compatibility)
        setCanSendMessage(followStatus === 'following' || friendStatus === 'friends');
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

  // OPTIONAL FEATURES: Fetch creator content
  const fetchJournals = async () => {
    try {
      const response = await api.get(`/journals/user/${id}`);
      setJournals(response.data || []);
    } catch (error) {
      console.error('Failed to fetch journals:', error);
      setJournals([]);
    }
  };

  const fetchLongformPosts = async () => {
    try {
      const response = await api.get(`/longform/user/${id}`);
      setLongformPosts(response.data || []);
    } catch (error) {
      console.error('Failed to fetch longform posts:', error);
      setLongformPosts([]);
    }
  };

  const fetchPhotoEssays = async () => {
    try {
      const response = await api.get(`/photo-essays/user/${id}`);
      setPhotoEssays(response.data || []);
    } catch (error) {
      console.error('Failed to fetch photo essays:', error);
      setPhotoEssays([]);
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

  // OPTIONAL FEATURES: Pin/unpin post
  const handlePinPost = async (postId) => {
    try {
      const response = await api.post(`/posts/${postId}/pin`);
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      showToast(response.data.isPinned ? 'Post pinned' : 'Post unpinned', 'success');
    } catch (error) {
      console.error('Failed to pin post:', error);
      showToast('Failed to pin post', 'error');
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

  const handleMediaSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validate file types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/ogg'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      showAlert('Please select only images (JPEG, PNG, GIF) or videos (MP4, WebM, OGG)', 'Invalid File Type');
      return;
    }

    // Limit to 3 files
    if (selectedMedia.length + files.length > 3) {
      showAlert('You can only upload up to 3 media files per post', 'Upload Limit Reached');
      return;
    }

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('media', file);
      });

      const response = await api.post('/upload/post-media', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSelectedMedia([...selectedMedia, ...response.data.media]);
    } catch (error) {
      console.error('Failed to upload media:', error);
      showAlert('Failed to upload media. Please try again.', 'Upload Failed');
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeMedia = (index) => {
    setSelectedMedia(selectedMedia.filter((_, i) => i !== index));
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && selectedMedia.length === 0) {
      showAlert('Please add some content or media to your post', 'Empty Post');
      return;
    }

    setPostLoading(true);
    try {
      // Convert emoji shortcuts before posting
      const contentWithEmojis = convertEmojiShortcuts(newPost);

      const postData = {
        content: contentWithEmojis,
        media: selectedMedia,
        visibility: postVisibility,
        contentWarning: contentWarning
      };

      const response = await api.post('/posts', postData);
      setPosts([response.data, ...posts]);
      setNewPost('');
      setSelectedMedia([]);
      setContentWarning('');
      setShowContentWarning(false);
      showToast('Post created successfully!', 'success');
    } catch (error) {
      console.error('Failed to create post:', error);
      showAlert('Failed to create post. Please try again.', 'Post Failed');
    } finally {
      setPostLoading(false);
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
      // Convert emoji shortcuts before posting
      const contentWithEmojis = convertEmojiShortcuts(content);

      const response = await api.post(`/posts/${postId}/comment`, { content: contentWithEmojis });
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
      // Convert emoji shortcuts before posting
      const contentWithEmojis = convertEmojiShortcuts(replyText);

      const response = await api.post(`/posts/${postId}/comment/${commentId}/reply`, {
        content: contentWithEmojis
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

  const checkFollowStatus = async () => {
    try {
      // Get user info to check if private account
      const userResponse = await api.get(`/users/${id}`);
      const profileUserId = userResponse.data._id;
      setIsPrivateAccount(userResponse.data.privacySettings?.isPrivateAccount || false);

      // Check if already following - get MY following list
      const myUserId = currentUser?.id || currentUser?._id;
      if (!myUserId) {
        console.error('Current user ID not available');
        setFollowStatus('none');
        return;
      }

      const followingResponse = await api.get(`/follow/following/${myUserId}`);
      const followingList = followingResponse.data.following || followingResponse.data;
      const isFollowing = followingList.some(user => user._id === profileUserId);

      if (isFollowing) {
        setFollowStatus('following');
        return;
      }

      // Check for pending follow requests (if private account)
      if (userResponse.data.privacySettings?.isPrivateAccount) {
        const requestsResponse = await api.get('/follow/requests/sent');
        const sentRequests = requestsResponse.data.sentRequests || requestsResponse.data;
        const pendingRequest = sentRequests.find(req => req.receiver._id === profileUserId);

        if (pendingRequest) {
          setFollowStatus('pending');
          setFollowRequestId(pendingRequest._id);
          return;
        }
      }

      setFollowStatus('none');
    } catch (error) {
      console.error('Failed to check follow status:', error);
      setFollowStatus('none');
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
      if (!user?._id) {
        showToast('User not loaded yet', 'error');
        return;
      }
      await api.post(`/friends/request/${user._id}`);
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
      if (!user?._id) {
        showToast('User not loaded yet', 'error');
        setShowUnfriendModal(false);
        return;
      }
      await api.delete(`/friends/${user._id}`);
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
    if (!user?._id) {
      showToast('User not loaded yet', 'error');
      return;
    }
    navigate(`/messages?chat=${user._id}`);
  };

  // New follow system handlers
  const handleFollow = async () => {
    try {
      if (!user?._id) {
        showToast('User not loaded yet', 'error');
        return;
      }
      const response = await api.post(`/follow/${user._id}`);

      if (isPrivateAccount) {
        setFollowStatus('pending');
        showToast('Follow request sent! 🎉', 'success');
      } else {
        setFollowStatus('following');
        fetchUserProfile(); // Refresh to update follower count
        showToast('Now following! 🎉', 'success');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to follow user', 'error');
    }
  };

  const handleUnfollow = async () => {
    try {
      if (!user?._id) {
        showToast('User not loaded yet', 'error');
        return;
      }
      await api.delete(`/follow/${user._id}`);
      setFollowStatus('none');
      fetchUserProfile(); // Refresh to update follower count
      showToast('Unfollowed', 'success');
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to unfollow user', 'error');
    }
  };

  const handleCancelFollowRequest = async () => {
    try {
      if (followRequestId) {
        await api.delete(`/follow/requests/${followRequestId}`);
        setFollowStatus('none');
        setFollowRequestId(null);
        showToast('Follow request cancelled', 'success');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to cancel follow request', 'error');
    }
  };

  const handleBlockUser = async () => {
    if (!window.confirm('Are you sure you want to block this user? They will not be able to see your content or contact you.')) {
      return;
    }

    try {
      if (!user?._id) {
        alert('User not loaded yet');
        return;
      }
      await api.post('/blocks', { blockedUserId: user._id });
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
      if (!user?._id) {
        alert('User not loaded yet');
        return;
      }
      await api.delete(`/blocks/${user._id}`);
      setIsBlocked(false);
      alert('User unblocked successfully');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to unblock user');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="profile-container">
          <ProfileSkeleton />
          <div className="profile-posts">
            <PostSkeleton />
            <PostSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="error">User not found</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />
      
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
                {user.isVerified && <span className="verified-badge" title="Verified">✓</span>}
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
                    {user.sexualOrientation.charAt(0).toUpperCase() + user.sexualOrientation.slice(1)}
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

              </div>

              {user.bio && <p className="profile-bio">{user.bio}</p>}

              {!isOwnProfile && (
                <div className="profile-action-buttons">
                  <div className="friend-actions">
                    {/* New Follow System Buttons */}
                    {followStatus === 'none' && (
                      <button className="btn-add-friend" onClick={handleFollow}>
                        ➕ Follow
                      </button>
                    )}
                    {followStatus === 'pending' && (
                      <button className="btn-cancel-request" onClick={handleCancelFollowRequest}>
                        ⏳ Pending
                      </button>
                    )}
                    {followStatus === 'following' && (
                      <button className="btn-unfriend" onClick={handleUnfollow}>
                        ✓ Following
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
                    {!canSendMessage && followStatus !== 'following' && (
                      <button
                        className="btn-message"
                        disabled
                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                        title="You must be following to message this user"
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
                          onClick={() => { setReportModal({ isOpen: true, type: 'user', contentId: null, userId: user?._id }); setShowActionsMenu(false); }}
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

              {/* PHASE 1 REFACTOR: Follower/following counts removed */}
              <div className="profile-stats">
                <div className="stat-item">
                  <span className="stat-value">{posts.length}</span>
                  <span className="stat-label">Posts</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-content">
          {/* OPTIONAL FEATURES: Creator profile tabs */}
          {user?.isCreator && (
            <div className="profile-tabs glossy" style={{ marginBottom: '20px', padding: '10px', borderRadius: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                className={`tab-button ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'posts' ? 'var(--pryde-purple)' : 'var(--background-light)',
                  color: activeTab === 'posts' ? 'white' : 'var(--text-main)',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'posts' ? 'bold' : 'normal',
                  transition: 'all 0.3s ease'
                }}
              >
                📝 Posts
              </button>
              <button
                className={`tab-button ${activeTab === 'journals' ? 'active' : ''}`}
                onClick={() => setActiveTab('journals')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'journals' ? 'var(--pryde-purple)' : 'var(--background-light)',
                  color: activeTab === 'journals' ? 'white' : 'var(--text-main)',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'journals' ? 'bold' : 'normal',
                  transition: 'all 0.3s ease'
                }}
              >
                📔 Journals
              </button>
              <button
                className={`tab-button ${activeTab === 'longform' ? 'active' : ''}`}
                onClick={() => setActiveTab('longform')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'longform' ? 'var(--pryde-purple)' : 'var(--background-light)',
                  color: activeTab === 'longform' ? 'white' : 'var(--text-main)',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'longform' ? 'bold' : 'normal',
                  transition: 'all 0.3s ease'
                }}
              >
                📖 Stories
              </button>
              <button
                className={`tab-button ${activeTab === 'photoEssays' ? 'active' : ''}`}
                onClick={() => setActiveTab('photoEssays')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'photoEssays' ? 'var(--pryde-purple)' : 'var(--background-light)',
                  color: activeTab === 'photoEssays' ? 'white' : 'var(--text-main)',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'photoEssays' ? 'bold' : 'normal',
                  transition: 'all 0.3s ease'
                }}
              >
                📸 Photo Essays
              </button>
            </div>
          )}

          <div className="profile-posts">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              {activeTab !== 'posts' && (
                <h2 className="section-title">{activeTab === 'journals' ? 'Journals' : activeTab === 'longform' ? 'Stories' : 'Photo Essays'}</h2>
              )}
              {isOwnProfile && activeTab === 'posts' && (
                <div className="create-post glossy fade-in">
                  <h2 className="section-title">✨ Share a thought...</h2>
                  <form onSubmit={handlePostSubmit}>
                    <textarea
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      placeholder="What are you reflecting on today?"
                      className="post-input glossy"
                      rows="4"
                    />

                    {selectedMedia.length > 0 && (
                      <div className="media-preview">
                        {selectedMedia.map((media, index) => (
                          <div key={index} className="media-preview-item">
                            {media.type === 'video' ? (
                              <video src={getImageUrl(media.url)} controls />
                            ) : (
                              <img src={getImageUrl(media.url)} alt={`Upload ${index + 1}`} />
                            )}
                            <button
                              type="button"
                              className="remove-media"
                              onClick={() => removeMedia(index)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {showContentWarning && (
                      <div className="content-warning-input">
                        <select
                          value={contentWarning}
                          onChange={(e) => setContentWarning(e.target.value)}
                          className="cw-input glossy"
                        >
                          <option value="">Select a content warning...</option>
                          <option value="Mental Health">Mental Health</option>
                          <option value="Violence">Violence</option>
                          <option value="Sexual Content">Sexual Content</option>
                          <option value="Substance Use">Substance Use</option>
                          <option value="Self-Harm">Self-Harm</option>
                          <option value="Death/Grief">Death/Grief</option>
                          <option value="Eating Disorders">Eating Disorders</option>
                          <option value="Abuse">Abuse</option>
                          <option value="Discrimination">Discrimination</option>
                          <option value="Medical Content">Medical Content</option>
                          <option value="Flashing Lights">Flashing Lights</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    )}

                    <div className="post-actions-bar">
                      <label className="btn-media-upload">
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={handleMediaSelect}
                          disabled={uploadingMedia || selectedMedia.length >= 3}
                          style={{ display: 'none' }}
                        />
                        {uploadingMedia ? '⏳ Uploading...' : '📷 Add Photos/Videos'}
                      </label>

                      <button
                        type="button"
                        className={`btn-content-warning ${showContentWarning ? 'active' : ''}`}
                        onClick={() => setShowContentWarning(!showContentWarning)}
                        title="Add content warning"
                      >
                        ⚠️ CW
                      </button>

                      {/* PHASE 1 REFACTOR: Simplified privacy options */}
                      <select
                        value={postVisibility}
                        onChange={(e) => setPostVisibility(e.target.value)}
                        className="privacy-selector glossy"
                      >
                        <option value="public">🌍 Public</option>
                        <option value="followers">👥 Connections</option>
                        <option value="private">🔒 Private</option>
                      </select>

                      <button type="submit" disabled={postLoading || uploadingMedia} className="btn-post glossy-gold">
                        {postLoading ? 'Publishing...' : 'Publish ✨'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* OPTIONAL FEATURES: Conditional rendering based on active tab */}
            {activeTab === 'posts' && (
              <>
                {loadingPosts ? (
                  <div className="loading-state">Loading posts...</div>
                ) : posts.length === 0 ? (
                  <div className="empty-state glossy">
                    <p>No posts yet</p>
                  </div>
                ) : (
                  <div className="posts-list">
                    {/* OPTIONAL FEATURES: Sort posts to show pinned first */}
                    {posts.sort((a, b) => {
                      if (a.isPinned && !b.isPinned) return -1;
                      if (!a.isPinned && b.isPinned) return 1;
                      return new Date(b.createdAt) - new Date(a.createdAt);
                    }).map((post) => {
                  // PHASE 1 REFACTOR: Use hasLiked boolean instead of checking likes array
                  const isLiked = post.hasLiked || false;

                  return (
                    <div key={post._id} className="post-card glossy fade-in" style={{ borderTop: post.isPinned ? '3px solid var(--pryde-purple)' : 'none' }}>
                      {/* OPTIONAL FEATURES: Pinned post indicator */}
                      {post.isPinned && (
                        <div style={{ padding: '8px 15px', background: 'var(--soft-lavender)', color: 'var(--pryde-purple)', fontSize: '0.85rem', fontWeight: 'bold', borderRadius: '8px 8px 0 0', marginBottom: '10px' }}>
                          📌 Pinned Post
                        </div>
                      )}
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
                                    {/* OPTIONAL FEATURES: Pin/unpin button */}
                                    <button
                                      className="dropdown-item"
                                      onClick={() => {
                                        handlePinPost(post._id);
                                        setOpenDropdownId(null);
                                      }}
                                    >
                                      {post.isPinned ? '📌 Unpin' : '📍 Pin'}
                                    </button>
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
                                      onClick={async () => {
                                        setOpenDropdownId(null);
                                        await handleDeletePost(post._id);
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
                              ref={editTextareaRef}
                              value={editPostText}
                              onChange={(e) => setEditPostText(e.target.value)}
                              className="edit-post-textarea"
                              placeholder="What's on your mind?"
                              autoFocus
                            />
                            <div className="edit-post-actions">
                              {/* PHASE 1 REFACTOR: Simplified privacy options */}
                              <select
                                value={editPostVisibility}
                                onChange={(e) => setEditPostVisibility(e.target.value)}
                                className="visibility-select"
                              >
                                <option value="public">🌍 Public</option>
                                <option value="followers">👥 Connections</option>
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
                                {post.originalPost.content && <p><FormattedText text={post.originalPost.content} /></p>}
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
                                {post.content && <p><FormattedText text={post.content} /></p>}
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

                      {/* PHASE 1 REFACTOR: Post stats removed (like counts hidden) */}
                      <div className="post-stats">
                        <span>{post.comments?.length || 0} comments</span>
                        <span>{post.shares?.length || 0} shares</span>
                      </div>

                      <div className="post-actions">
                        <div className="reaction-container">
                          <button
                            className={`action-btn ${isLiked || post.reactions?.some(r => r.user?._id === currentUser?.id || r.user === currentUser?.id) ? 'liked' : ''}`}
                            onClick={() => {
                              // Click to react with default emoji (heart)
                              handlePostReaction(post._id, '❤️');
                            }}
                            onMouseEnter={() => {
                              // Hover shows emoji picker on desktop
                              if (window.innerWidth > 768) {
                                setShowReactionPicker(`post-${post._id}`);
                              }
                            }}
                            onTouchStart={(e) => {
                              // Long press shows emoji picker on mobile
                              const touchTimer = setTimeout(() => {
                                setShowReactionPicker(`post-${post._id}`);
                              }, 500);
                              e.currentTarget.dataset.touchTimer = touchTimer;
                            }}
                            onTouchEnd={(e) => {
                              // Clear long press timer
                              if (e.currentTarget.dataset.touchTimer) {
                                clearTimeout(e.currentTarget.dataset.touchTimer);
                              }
                            }}
                          >
                            <span>
                              {post.reactions?.find(r => r.user?._id === currentUser?.id || r.user === currentUser?.id)?.emoji || '🤍'}
                            </span> React
                          </button>
                          {post.reactions?.length > 0 && (
                            <button
                              className="reaction-count-btn"
                              onClick={() => setReactionDetailsModal({
                                isOpen: true,
                                reactions: post.reactions || [],
                                likes: post.likes || []
                              })}
                              title="See who reacted"
                            >
                              ({post.reactions.length})
                            </button>
                          )}
                          {showReactionPicker === `post-${post._id}` && (
                            <div
                              className="reaction-picker"
                              onMouseEnter={() => {
                                if (window.innerWidth > 768) {
                                  setShowReactionPicker(`post-${post._id}`);
                                }
                              }}
                              onMouseLeave={() => {
                                if (window.innerWidth > 768) {
                                  setTimeout(() => {
                                    setShowReactionPicker(null);
                                  }, 300);
                                }
                              }}
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
                                  <Link to={`/profile/${comment.user?.username}`} className="comment-avatar" style={{ textDecoration: 'none' }}>
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
                                          <FormattedText text={comment.content} />
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
                                              className={`comment-action-btn ${comment.reactions?.some(r => r.user?._id === currentUser?.id || r.user === currentUser?.id) ? 'liked' : ''}`}
                                              onClick={(e) => {
                                                // On mobile, toggle picker; on desktop, like immediately
                                                if (window.innerWidth <= 768) {
                                                  e.preventDefault();
                                                  setShowReactionPicker(showReactionPicker === `comment-${comment._id}` ? null : `comment-${comment._id}`);
                                                } else {
                                                  handleCommentReaction(post._id, comment._id, '👍');
                                                }
                                              }}
                                              onMouseEnter={() => {
                                                if (window.innerWidth > 768) {
                                                  setShowReactionPicker(`comment-${comment._id}`);
                                                }
                                              }}
                                            >
                                              {comment.reactions?.find(r => r.user?._id === currentUser?.id || r.user === currentUser?.id)?.emoji || '👍'} Like
                                            </button>
                                            {comment.reactions?.length > 0 && (
                                              <button
                                                className="reaction-count-btn"
                                                onClick={() => setReactionDetailsModal({
                                                  isOpen: true,
                                                  reactions: comment.reactions || [],
                                                  likes: []
                                                })}
                                                title="See who reacted"
                                              >
                                                ({comment.reactions.length})
                                              </button>
                                            )}
                                            {showReactionPicker === `comment-${comment._id}` && (
                                              <div
                                                className="reaction-picker"
                                                onMouseEnter={() => {
                                                  if (window.innerWidth > 768) {
                                                    setShowReactionPicker(`comment-${comment._id}`);
                                                  }
                                                }}
                                                onMouseLeave={() => {
                                                  if (window.innerWidth > 768) {
                                                    setShowReactionPicker(null);
                                                  }
                                                }}
                                              >
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '👍')} title="Like">👍</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '❤️')} title="Love">❤️</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '😂')} title="Haha">😂</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '😮')} title="Wow">😮</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '😢')} title="Sad">😢</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '😡')} title="Angry">😡</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '🤗')} title="Care">🤗</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '🎉')} title="Celebrate">🎉</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '🤔')} title="Think">🤔</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '🔥')} title="Fire">🔥</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '👏')} title="Clap">👏</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '🤯')} title="Mind Blown">🤯</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '🤢')} title="Disgust">🤢</button>
                                                <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, comment._id, '👎')} title="Dislike">👎</button>
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
                                          <Link to={`/profile/${reply.user?.username}`} className="comment-avatar" style={{ textDecoration: 'none' }}>
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
                                                  <FormattedText text={reply.content} />
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
                                                      className={`comment-action-btn ${reply.reactions?.some(r => r.user?._id === currentUser?.id || r.user === currentUser?.id) ? 'liked' : ''}`}
                                                      onClick={(e) => {
                                                        // On mobile, toggle picker; on desktop, like immediately
                                                        if (window.innerWidth <= 768) {
                                                          e.preventDefault();
                                                          setShowReactionPicker(showReactionPicker === `reply-${reply._id}` ? null : `reply-${reply._id}`);
                                                        } else {
                                                          handleCommentReaction(post._id, reply._id, '👍');
                                                        }
                                                      }}
                                                      onMouseEnter={() => {
                                                        if (window.innerWidth > 768) {
                                                          setShowReactionPicker(`reply-${reply._id}`);
                                                        }
                                                      }}
                                                    >
                                                      {reply.reactions?.find(r => r.user?._id === currentUser?.id || r.user === currentUser?.id)?.emoji || '👍'} Like
                                                    </button>
                                                    {reply.reactions?.length > 0 && (
                                                      <button
                                                        className="reaction-count-btn"
                                                        onClick={() => setReactionDetailsModal({
                                                          isOpen: true,
                                                          reactions: reply.reactions || [],
                                                          likes: []
                                                        })}
                                                        title="See who reacted"
                                                      >
                                                        ({reply.reactions.length})
                                                      </button>
                                                    )}
                                                    {showReactionPicker === `reply-${reply._id}` && (
                                                      <div
                                                        className="reaction-picker"
                                                        onMouseEnter={() => {
                                                          if (window.innerWidth > 768) {
                                                            setShowReactionPicker(`reply-${reply._id}`);
                                                          }
                                                        }}
                                                        onMouseLeave={() => {
                                                          if (window.innerWidth > 768) {
                                                            setShowReactionPicker(null);
                                                          }
                                                        }}
                                                      >
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '👍')} title="Like">👍</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '❤️')} title="Love">❤️</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '😂')} title="Haha">😂</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '😮')} title="Wow">😮</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '😢')} title="Sad">😢</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '😡')} title="Angry">😡</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '🤗')} title="Care">🤗</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '🎉')} title="Celebrate">🎉</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '🤔')} title="Think">🤔</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '🔥')} title="Fire">🔥</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '👏')} title="Clap">👏</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '🤯')} title="Mind Blown">🤯</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '🤢')} title="Disgust">🤢</button>
                                                        <button className="reaction-btn" onClick={() => handleCommentReaction(post._id, reply._id, '👎')} title="Dislike">👎</button>
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
              </>
            )}

            {/* OPTIONAL FEATURES: Journals tab */}
            {activeTab === 'journals' && (
              <div className="journals-list">
                {journals.length === 0 ? (
                  <div className="empty-state glossy">
                    <p>No journal entries yet</p>
                  </div>
                ) : (
                  journals.map((journal) => (
                    <div key={journal._id} className="journal-card glossy fade-in" style={{ marginBottom: '20px', padding: '20px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                        <div>
                          <h3 style={{ margin: '0 0 10px 0', color: 'var(--pryde-purple)' }}>{journal.title || 'Untitled Entry'}</h3>
                          <div style={{ display: 'flex', gap: '10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            <span>📅 {new Date(journal.createdAt).toLocaleDateString()}</span>
                            {journal.mood && <span>😊 {journal.mood}</span>}
                            <span>🔒 {journal.visibility}</span>
                          </div>
                        </div>
                      </div>
                      <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{journal.content}</p>
                      {journal.tags && journal.tags.length > 0 && (
                        <div style={{ marginTop: '15px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {journal.tags.map((tag, idx) => (
                            <span key={idx} style={{ padding: '4px 12px', background: 'var(--soft-lavender)', borderRadius: '12px', fontSize: '0.85rem', color: 'var(--pryde-purple)' }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* OPTIONAL FEATURES: Longform tab */}
            {activeTab === 'longform' && (
              <div className="longform-list">
                {longformPosts.length === 0 ? (
                  <div className="empty-state glossy">
                    <p>No stories yet</p>
                  </div>
                ) : (
                  longformPosts.map((longform) => (
                    <div key={longform._id} className="longform-card glossy fade-in" style={{ marginBottom: '20px', padding: '20px', borderRadius: '12px' }}>
                      {longform.coverImage && (
                        <img src={getImageUrl(longform.coverImage)} alt={longform.title} style={{ width: '100%', borderRadius: '8px', marginBottom: '15px' }} />
                      )}
                      <h2 style={{ margin: '0 0 10px 0', color: 'var(--pryde-purple)' }}>{longform.title}</h2>
                      <div style={{ display: 'flex', gap: '10px', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                        <span>📅 {new Date(longform.createdAt).toLocaleDateString()}</span>
                        {longform.readTime && <span>⏱️ {longform.readTime} min read</span>}
                        <span>🔒 {longform.visibility}</span>
                      </div>
                      <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{longform.body.substring(0, 300)}...</p>
                      <Link to={`/longform/${longform._id}`} style={{ color: 'var(--pryde-purple)', fontWeight: 'bold', textDecoration: 'none' }}>
                        Read more →
                      </Link>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* OPTIONAL FEATURES: Photo Essays tab */}
            {activeTab === 'photoEssays' && (
              <div className="photo-essays-list">
                {photoEssays.length === 0 ? (
                  <div className="empty-state glossy">
                    <p>No photo essays yet</p>
                  </div>
                ) : (
                  photoEssays.map((essay) => (
                    <div key={essay._id} className="photo-essay-card glossy fade-in" style={{ marginBottom: '20px', padding: '20px', borderRadius: '12px' }}>
                      <h3 style={{ margin: '0 0 15px 0', color: 'var(--pryde-purple)' }}>{essay.title}</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                        {essay.photos && essay.photos.slice(0, 4).map((photo, idx) => (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img src={getImageUrl(photo.url)} alt={photo.caption || `Photo ${idx + 1}`} style={{ width: '100%', borderRadius: '8px', aspectRatio: '1', objectFit: 'cover' }} />
                            {photo.caption && (
                              <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{photo.caption}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      {essay.photos && essay.photos.length > 4 && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>+{essay.photos.length - 4} more photos</p>
                      )}
                      <div style={{ display: 'flex', gap: '10px', fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                        <span>📅 {new Date(essay.createdAt).toLocaleDateString()}</span>
                        <span>🔒 {essay.visibility}</span>
                      </div>
                    </div>
                  ))
                )}
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

            {/* PHASE 1 REFACTOR: Followers sidebar removed (follower counts hidden) */}
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

      {reactionDetailsModal.isOpen && (
        <ReactionDetailsModal
          reactions={reactionDetailsModal.reactions}
          likes={reactionDetailsModal.likes}
          onClose={() => setReactionDetailsModal({ isOpen: false, reactions: [], likes: [] })}
        />
      )}
    </div>
  );
}

export default Profile;
