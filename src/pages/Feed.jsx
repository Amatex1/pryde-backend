import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PasskeyBanner from '../components/PasskeyBanner';
import ReportModal from '../components/ReportModal';
import PhotoViewer from '../components/PhotoViewer';
import CustomModal from '../components/CustomModal';
import ShareModal from '../components/ShareModal';
import ReactionDetailsModal from '../components/ReactionDetailsModal';
import FormattedText from '../components/FormattedText';
import { useModal } from '../hooks/useModal';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import { onUserOnline, onUserOffline, onOnlineUsers } from '../utils/socket';
import { convertEmojiShortcuts } from '../utils/textFormatting';
import './Feed.css';

function Feed({ onOpenMiniChat }) {
  const [searchParams] = useSearchParams();
  const { modalState, closeModal, showAlert, showConfirm } = useModal();
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingPosts, setFetchingPosts] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [reportModal, setReportModal] = useState({ isOpen: false, type: '', contentId: null, userId: null });
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [photoViewerImage, setPhotoViewerImage] = useState(null);
  const [showCommentBox, setShowCommentBox] = useState({});
  const [commentText, setCommentText] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPostText, setEditPostText] = useState('');
  const [openCommentDropdownId, setOpenCommentDropdownId] = useState(null);
  const [postVisibility, setPostVisibility] = useState('friends');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [hiddenFromUsers, setHiddenFromUsers] = useState([]);
  const [sharedWithUsers, setSharedWithUsers] = useState([]);
  const [showReplies, setShowReplies] = useState({}); // Track which comments have replies visible
  const [showReactionPicker, setShowReactionPicker] = useState(null); // Track which comment shows reaction picker
  const [editPostVisibility, setEditPostVisibility] = useState('friends');
  const [editHiddenFromUsers, setEditHiddenFromUsers] = useState([]);
  const [editSharedWithUsers, setEditSharedWithUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [onlineFriends, setOnlineFriends] = useState([]);
  const [offlineFriends, setOfflineFriends] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [friendsTab, setFriendsTab] = useState('online'); // 'online' or 'offline'
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [trending, setTrending] = useState([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState([]);
  const [shareModal, setShareModal] = useState({ isOpen: false, post: null });
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [reactionDetailsModal, setReactionDetailsModal] = useState({ isOpen: false, reactions: [], likes: [] });
  const currentUser = getCurrentUser();
  const postRefs = useRef({});
  const commentRefs = useRef({});

  useEffect(() => {
    fetchPosts();
    fetchBlockedUsers();
    fetchFriends();
    fetchTrending();
    fetchBookmarkedPosts();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.post-dropdown-container') && !event.target.closest('.comment-dropdown-container')) {
        setOpenDropdownId(null);
        setOpenCommentDropdownId(null);
      }
      // Close reaction picker on mobile when clicking outside
      if (window.innerWidth <= 768 && !event.target.closest('.reaction-container')) {
        setShowReactionPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Socket listeners for online/offline status
  useEffect(() => {
    // Get initial online users list
    onOnlineUsers((users) => {
      setOnlineUsers(users);
    });

    // Listen for users coming online
    onUserOnline((data) => {
      setOnlineUsers((prev) => {
        if (!prev.includes(data.userId)) {
          return [...prev, data.userId];
        }
        return prev;
      });
      // Refresh friends list
      fetchFriends();
    });

    // Listen for users going offline
    onUserOffline((data) => {
      setOnlineUsers((prev) => prev.filter(id => id !== data.userId));
      // Refresh friends list
      fetchFriends();
    });

    // Refresh friends list every 30 seconds
    const interval = setInterval(fetchFriends, 30000);

    return () => clearInterval(interval);
  }, []);

  // Handle scrolling to specific post/comment from notifications
  useEffect(() => {
    const postId = searchParams.get('post');
    const commentId = searchParams.get('comment');

    if (postId && posts.length > 0) {
      // Wait for DOM to update
      setTimeout(() => {
        const postElement = postRefs.current[postId];
        if (postElement) {
          postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          postElement.classList.add('highlighted-post');

          // Remove highlight after 3 seconds
          setTimeout(() => {
            postElement.classList.remove('highlighted-post');
          }, 3000);

          // If there's a specific comment, scroll to it
          if (commentId) {
            setTimeout(() => {
              const commentElement = commentRefs.current[commentId];
              if (commentElement) {
                commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                commentElement.classList.add('highlighted-comment');

                // Remove highlight after 3 seconds
                setTimeout(() => {
                  commentElement.classList.remove('highlighted-comment');
                }, 3000);
              }
            }, 500);
          }
        }
      }, 500);
    }
  }, [posts, searchParams]);

  const fetchFriends = async () => {
    try {
      const [onlineRes, offlineRes] = await Promise.all([
        api.get('/friends/online'),
        api.get('/friends/offline')
      ]);
      setOnlineFriends(onlineRes.data);
      setOfflineFriends(offlineRes.data);
      setFriends([...onlineRes.data, ...offlineRes.data]);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  // Helper function to format time since last seen
  const getTimeSince = (date) => {
    if (!date) return 'Unknown';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const fetchTrending = async () => {
    try {
      const response = await api.get('/search/trending');
      setTrending(response.data);
    } catch (error) {
      console.error('Failed to fetch trending:', error);
    }
  };

  const fetchBlockedUsers = async () => {
    try {
      const response = await api.get('/blocks');
      const blockedIds = response.data.map(block => block.blocked._id);
      setBlockedUsers(blockedIds);
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      const response = await api.get('/posts');
      setPosts(response.data.posts || []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setFetchingPosts(false);
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

    // Limit to 10 files
    if (selectedMedia.length + files.length > 10) {
      showAlert('You can only upload up to 10 media files per post', 'Upload Limit Reached');
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
      console.error('Media upload failed:', error);
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

    setLoading(true);
    try {
      // Convert emoji shortcuts before posting
      const contentWithEmojis = convertEmojiShortcuts(newPost);

      const postData = {
        content: contentWithEmojis,
        media: selectedMedia,
        visibility: postVisibility
      };

      // Add custom privacy settings if applicable
      if (postVisibility === 'custom') {
        if (hiddenFromUsers.length > 0) {
          postData.hiddenFrom = hiddenFromUsers;
        }
        if (sharedWithUsers.length > 0) {
          postData.sharedWith = sharedWithUsers;
        }
      }

      const response = await api.post('/posts', postData);
      setPosts([response.data, ...posts]);
      setNewPost('');
      setSelectedMedia([]);
      setPostVisibility('friends');
      setHiddenFromUsers([]);
      setSharedWithUsers([]);
    } catch (error) {
      console.error('Post creation failed:', error);
      showAlert('Failed to create post. Please try again.', 'Post Failed');
    } finally {
      setLoading(false);
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

  const toggleCommentBox = (postId) => {
    setShowCommentBox(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
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
    } catch (error) {
      console.error('Failed to edit comment:', error);
      showAlert('Failed to edit comment. Please try again.', 'Edit Failed');
    }
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const toggleDropdown = (postId) => {
    setOpenDropdownId(openDropdownId === postId ? null : postId);
  };

  const handleEditPost = (post) => {
    setEditingPostId(post._id);
    setEditPostText(post.content);
    setEditPostVisibility(post.visibility || 'friends');
    setEditHiddenFromUsers(post.hiddenFrom?.map(u => u._id || u) || []);
    setEditSharedWithUsers(post.sharedWith?.map(u => u._id || u) || []);
    setOpenDropdownId(null);
  };

  const handleSaveEditPost = async (postId) => {
    if (!editPostText.trim()) return;

    try {
      const updateData = {
        content: editPostText,
        visibility: editPostVisibility
      };

      // Add custom privacy settings if applicable
      if (editPostVisibility === 'custom') {
        if (editHiddenFromUsers.length > 0) {
          updateData.hiddenFrom = editHiddenFromUsers;
        }
        if (editSharedWithUsers.length > 0) {
          updateData.sharedWith = editSharedWithUsers;
        }
      } else {
        // Clear custom privacy if not using custom visibility
        updateData.hiddenFrom = [];
        updateData.sharedWith = [];
      }

      const response = await api.put(`/posts/${postId}`, updateData);
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setEditingPostId(null);
      setEditPostText('');
      setEditPostVisibility('friends');
      setEditHiddenFromUsers([]);
      setEditSharedWithUsers([]);
      showAlert('Post updated successfully!', 'Success');
    } catch (error) {
      console.error('Failed to edit post:', error);
      showAlert('Failed to edit post. Please try again.', 'Edit Failed');
    }
  };

  const handleCancelEditPost = () => {
    setEditingPostId(null);
    setEditPostText('');
    setEditPostVisibility('friends');
    setEditHiddenFromUsers([]);
    setEditSharedWithUsers([]);
  };

  const handleDeleteComment = async (postId, commentId) => {
    const confirmed = await showConfirm('Are you sure you want to delete this comment?', 'Delete Comment', 'Delete', 'Cancel');
    if (!confirmed) return;

    try {
      const response = await api.delete(`/posts/${postId}/comment/${commentId}`);
      setPosts(posts.map(p => p._id === postId ? response.data : p));
    } catch (error) {
      console.error('Failed to delete comment:', error);
      showAlert('Failed to delete comment. Please try again.', 'Delete Failed');
    }
  };

  const handleReplyToComment = (postId, commentId) => {
    setReplyingToComment({ postId, commentId });
    setReplyText('');
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !replyingToComment) return;

    try {
      const { postId, commentId } = replyingToComment;
      // Convert emoji shortcuts before posting
      const contentWithEmojis = convertEmojiShortcuts(replyText);

      const response = await api.post(`/posts/${postId}/comment/${commentId}/reply`, { content: contentWithEmojis });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setReplyingToComment(null);
      setReplyText('');
    } catch (error) {
      console.error('Failed to reply to comment:', error);
      showAlert('Failed to reply. Please try again.', 'Reply Failed');
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

  const fetchBookmarkedPosts = async () => {
    try {
      const response = await api.get('/bookmarks');
      setBookmarkedPosts(response.data.bookmarks.map(post => post._id));
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
    }
  };

  const handleBookmark = async (postId) => {
    const isBookmarked = bookmarkedPosts.includes(postId);

    try {
      if (isBookmarked) {
        await api.delete(`/bookmarks/${postId}`);
        setBookmarkedPosts(bookmarkedPosts.filter(id => id !== postId));
      } else {
        await api.post(`/bookmarks/${postId}`);
        setBookmarkedPosts([...bookmarkedPosts, postId]);
      }
    } catch (error) {
      console.error('Failed to bookmark post:', error);
      showAlert(error.response?.data?.message || 'Failed to bookmark post.', 'Bookmark Failed');
    }
  };

  const handleDelete = async (postId) => {
    const confirmed = await showConfirm('Are you sure you want to delete this post?', 'Delete Post', 'Delete', 'Cancel');
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/posts/${postId}`);
      setPosts(posts.filter(p => p._id !== postId));
    } catch (error) {
      console.error('Failed to delete post:', error);
      showAlert('Failed to delete post. Please try again.', 'Delete Failed');
    }
  };

  return (
    <div className="page-container">
      <Navbar onOpenMiniChat={onOpenMiniChat} />
      <PasskeyBanner />

      <div className="feed-container">
        <div className="feed-content">
          <div className="create-post glossy fade-in">
            <h2 className="section-title">What's on your mind?</h2>
            <form onSubmit={handlePostSubmit}>
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Share something amazing..."
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

              <div className="post-actions-bar">
                <label className="btn-media-upload">
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleMediaSelect}
                    disabled={uploadingMedia || selectedMedia.length >= 10}
                    style={{ display: 'none' }}
                  />
                  {uploadingMedia ? '⏳ Uploading...' : '📷 Add Photos/Videos'}
                </label>

                <select
                  value={postVisibility}
                  onChange={(e) => {
                    setPostVisibility(e.target.value);
                    if (e.target.value === 'custom') {
                      setShowPrivacyModal(true);
                    }
                  }}
                  className="privacy-selector glossy"
                >
                  <option value="public">🌍 Public</option>
                  <option value="friends">👥 Friends</option>
                  <option value="custom">⚙️ Custom</option>
                  <option value="private">🔒 Only Me</option>
                </select>

                <button type="submit" disabled={loading || uploadingMedia} className="btn-post glossy-gold">
                  {loading ? 'Posting...' : 'Share Post ✨'}
                </button>
              </div>
            </form>
          </div>

          <div className="posts-list">
            {fetchingPosts ? (
              <div className="loading-state">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="empty-state glossy">
                <h3>No posts yet</h3>
                <p>Be the first to share something!</p>
              </div>
            ) : (
              posts
                .filter(post => !blockedUsers.includes(post.author?._id))
                .map((post) => {
                const isLiked = post.likes?.some(like =>
                  (typeof like === 'string' ? like : like._id) === (currentUser?.id || currentUser?._id)
                );

                return (
                  <div
                    key={post._id}
                    className="post-card glossy fade-in"
                    ref={(el) => postRefs.current[post._id] = el}
                  >
                    <div className="post-header">
                      <div className="post-author">
                        <Link to={`/profile/${post.author?._id}`} className="author-avatar" style={{ textDecoration: 'none' }}>
                          {post.author?.profilePhoto ? (
                            <img src={getImageUrl(post.author.profilePhoto)} alt={post.author.username} />
                          ) : (
                            <span>{post.author?.displayName?.charAt(0).toUpperCase() || post.author?.username?.charAt(0).toUpperCase() || 'U'}</span>
                          )}
                        </Link>
                        <div className="author-info">
                          <Link to={`/profile/${post.author?._id}`} className="author-name" style={{ textDecoration: 'none', color: 'inherit' }}>
                            {post.author?.displayName || post.author?.username || 'User'}
                          </Link>
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
                                      handleDelete(post._id);
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
                            <div className={`post-media-grid ${post.originalPost.media.length === 1 ? 'single' : post.originalPost.media.length === 2 ? 'double' : 'multiple'}`}>
                              {post.originalPost.media.map((media, index) => (
                                <div key={index} className="post-media-item">
                                  {media.type === 'video' ? (
                                    <video src={getImageUrl(media.url)} controls />
                                  ) : (
                                    <img
                                      src={getImageUrl(media.url)}
                                      alt={`Shared post media ${index + 1}`}
                                      onClick={() => setPhotoViewerImage(getImageUrl(media.url))}
                                      style={{ cursor: 'pointer' }}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {editingPostId === post._id ? (
                            <div className="post-edit-box">
                              <textarea
                                value={editPostText}
                                onChange={(e) => setEditPostText(e.target.value)}
                                className="post-edit-textarea"
                                autoFocus
                                rows="4"
                              />
                              <div className="post-edit-privacy">
                                <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>
                                  Privacy:
                                </label>
                                <select
                                  value={editPostVisibility}
                                  onChange={(e) => setEditPostVisibility(e.target.value)}
                                  className="privacy-selector glossy"
                                  style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                                >
                                  <option value="public">🌍 Public</option>
                                  <option value="friends">👥 Friends</option>
                                  <option value="custom">⚙️ Custom</option>
                                  <option value="private">🔒 Only Me</option>
                                </select>
                              </div>
                              <div className="post-edit-actions">
                                <button
                                  onClick={() => handleSaveEditPost(post._id)}
                                  className="btn-save-post"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEditPost}
                                  className="btn-cancel-post"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            post.content && (
                              <p>
                                <FormattedText text={post.content} />
                              </p>
                            )
                          )}

                          {post.media && post.media.length > 0 && (
                            <div className={`post-media-grid ${post.media.length === 1 ? 'single' : post.media.length === 2 ? 'double' : 'multiple'}`}>
                              {post.media.map((media, index) => (
                                <div key={index} className="post-media-item">
                                  {media.type === 'video' ? (
                                    <video src={getImageUrl(media.url)} controls />
                                  ) : (
                                    <img
                                      src={getImageUrl(media.url)}
                                      alt={`Post media ${index + 1}`}
                                      onClick={() => setPhotoViewerImage(getImageUrl(media.url))}
                                      style={{ cursor: 'pointer' }}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="post-actions">
                      <div className="reaction-container">
                        <button
                          className={`action-btn ${isLiked || post.reactions?.some(r => r.user?._id === currentUser?.id || r.user === currentUser?.id) ? 'liked' : ''}`}
                          onClick={() => {
                            // Click shows reaction list
                            if ((post.reactions?.length || 0) + (post.likes?.length || 0) > 0) {
                              setReactionDetailsModal({
                                isOpen: true,
                                reactions: post.reactions || [],
                                likes: post.likes || []
                              });
                            }
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
                            {post.reactions?.find(r => r.user?._id === currentUser?.id || r.user === currentUser?.id)?.emoji || (isLiked ? '❤️' : '🤍')}
                          </span> React {((post.reactions?.length || 0) + (post.likes?.length || 0)) > 0 && `(${(post.reactions?.length || 0) + (post.likes?.length || 0)})`}
                        </button>
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
                        onClick={() => toggleCommentBox(post._id)}
                      >
                        <span>💬</span> Comment ({post.comments?.length || 0})
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => handleShare(post)}
                      >
                        <span>🔗</span> Share ({post.shares?.length || 0})
                      </button>
                      <button
                        className={`action-btn ${bookmarkedPosts.includes(post._id) ? 'bookmarked' : ''}`}
                        onClick={() => handleBookmark(post._id)}
                        title={bookmarkedPosts.includes(post._id) ? 'Remove bookmark' : 'Bookmark post'}
                      >
                        <span>{bookmarkedPosts.includes(post._id) ? '🔖' : '📑'}</span> Bookmark
                      </button>
                    </div>

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
                                          onClick={() => {
                                            handleReplyToComment(post._id, comment._id);
                                          }}
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
              })
            )}
          </div>
        </div>

        <div className={`feed-sidebar ${showMobileSidebar ? 'mobile-visible' : ''}`}>
          {/* Trending Topics */}
          <div className="sidebar-card glossy">
            <h3 className="sidebar-title">Trending Topics</h3>
            <div className="trending-list">
              {trending.length > 0 ? (
                trending.map((item, index) => (
                  <Link
                    key={index}
                    to={`/hashtag/${item.hashtag.replace('#', '')}`}
                    className="trending-item"
                  >
                    {item.hashtag}
                    <span className="trending-count">{item.count} posts</span>
                  </Link>
                ))
              ) : (
                <div className="no-trending">
                  <p>No trending topics yet</p>
                  <p className="trending-hint">Start using hashtags in your posts!</p>
                </div>
              )}
            </div>
          </div>

          {/* Crisis Support */}
          <div className="sidebar-card glossy" style={{
            background: 'linear-gradient(135deg, var(--soft-lavender) 0%, rgba(108, 92, 231, 0.1) 100%)',
            border: '2px solid var(--pryde-purple)'
          }}>
            <h3 className="sidebar-title" style={{ color: 'var(--pryde-purple)' }}>💜 Need Support?</h3>
            <div style={{ padding: '0.5rem 0' }}>
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
                If you're in crisis, help is available 24/7.
              </p>
              <Link
                to="/helplines"
                className="btn-primary"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  background: 'var(--pryde-purple)',
                  color: 'white',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--electric-blue)'}
                onMouseLeave={(e) => e.target.style.background = 'var(--pryde-purple)'}
              >
                View Crisis Helplines
              </Link>
            </div>
          </div>

          {/* Friends List */}
          <div className="sidebar-card glossy">
            <h3 className="sidebar-title">Friends</h3>

            {/* Search Bar */}
            <div className="friends-search-bar">
              <input
                type="text"
                placeholder="Search friends..."
                value={friendSearchQuery}
                onChange={(e) => setFriendSearchQuery(e.target.value)}
                className="friends-search-input"
              />
            </div>

            {/* Tabs */}
            <div className="friends-tabs">
              <button
                className={`friends-tab ${friendsTab === 'online' ? 'active' : ''}`}
                onClick={() => setFriendsTab('online')}
              >
                Online ({onlineFriends.filter(f =>
                  (f.displayName || f.username).toLowerCase().includes(friendSearchQuery.toLowerCase())
                ).length})
              </button>
              <button
                className={`friends-tab ${friendsTab === 'offline' ? 'active' : ''}`}
                onClick={() => setFriendsTab('offline')}
              >
                Offline ({offlineFriends.filter(f =>
                  (f.displayName || f.username).toLowerCase().includes(friendSearchQuery.toLowerCase())
                ).length})
              </button>
            </div>

            <div className="friends-sidebar-list">
              {/* Online Friends Tab */}
              {friendsTab === 'online' && (
                <>
                  {onlineFriends
                    .filter(friend =>
                      (friend.displayName || friend.username).toLowerCase().includes(friendSearchQuery.toLowerCase())
                    )
                    .map((friend) => (
                      <div key={friend._id} className="friend-sidebar-item">
                        <div className="friend-sidebar-main">
                          <div className="friend-sidebar-avatar">
                            {friend.profilePhoto ? (
                              <img src={getImageUrl(friend.profilePhoto)} alt={friend.displayName} />
                            ) : (
                              <span>{friend.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                            )}
                            <span className="status-dot online"></span>
                          </div>
                          <div className="friend-sidebar-info">
                            <div className="friend-sidebar-name">{friend.displayName || friend.username}</div>
                            <div className="friend-sidebar-status online-status">Online</div>
                          </div>
                        </div>
                        <div className="friend-sidebar-actions">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (onOpenMiniChat) {
                                onOpenMiniChat(friend);
                              }
                            }}
                            className="btn-friend-action"
                            title="Chat"
                            type="button"
                          >
                            💬
                          </button>
                          <Link
                            to={`/profile/${friend._id}`}
                            className="btn-friend-action"
                            title="View Profile"
                          >
                            👤
                          </Link>
                        </div>
                      </div>
                    ))}
                  {onlineFriends.filter(f =>
                    (f.displayName || f.username).toLowerCase().includes(friendSearchQuery.toLowerCase())
                  ).length === 0 && (
                    <div className="no-friends">
                      <p>{friendSearchQuery ? 'No matching online friends' : 'No friends online'}</p>
                    </div>
                  )}
                </>
              )}

              {/* Offline Friends Tab */}
              {friendsTab === 'offline' && (
                <>
                  {offlineFriends
                    .filter(friend =>
                      (friend.displayName || friend.username).toLowerCase().includes(friendSearchQuery.toLowerCase())
                    )
                    .map((friend) => (
                      <div key={friend._id} className="friend-sidebar-item">
                        <div className="friend-sidebar-main">
                          <div className="friend-sidebar-avatar">
                            {friend.profilePhoto ? (
                              <img src={getImageUrl(friend.profilePhoto)} alt={friend.displayName} />
                            ) : (
                              <span>{friend.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                            )}
                            <span className="status-dot offline"></span>
                          </div>
                          <div className="friend-sidebar-info">
                            <div className="friend-sidebar-name">{friend.displayName || friend.username}</div>
                            <div className="friend-sidebar-status offline-status">{getTimeSince(friend.lastSeen)}</div>
                          </div>
                        </div>
                        <div className="friend-sidebar-actions">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (onOpenMiniChat) {
                                onOpenMiniChat(friend);
                              }
                            }}
                            className="btn-friend-action"
                            title="Chat"
                            type="button"
                          >
                            💬
                          </button>
                          <Link
                            to={`/profile/${friend._id}`}
                            className="btn-friend-action"
                            title="View Profile"
                          >
                            👤
                          </Link>
                        </div>
                      </div>
                    ))}
                  {offlineFriends.filter(f =>
                    (f.displayName || f.username).toLowerCase().includes(friendSearchQuery.toLowerCase())
                  ).length === 0 && (
                    <div className="no-friends">
                      <p>{friendSearchQuery ? 'No matching offline friends' : 'No friends offline'}</p>
                    </div>
                  )}
                </>
              )}

              {/* No Friends at All */}
              {friends.length === 0 && (
                <div className="no-friends">
                  <p>No friends yet</p>
                  <p className="friends-hint">Add friends to start chatting!</p>
                </div>
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

      {/* Privacy Settings Modal */}
      {showPrivacyModal && (
        <div className="modal-overlay" onClick={() => setShowPrivacyModal(false)}>
          <div className="modal-content privacy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Custom Privacy Settings</h2>
              <button className="btn-close" onClick={() => setShowPrivacyModal(false)}>×</button>
            </div>

            <div className="privacy-modal-body">
              <div className="privacy-section">
                <h3>Hide from specific friends</h3>
                <p className="privacy-description">Select friends who won't see this post</p>
                <div className="friends-checklist">
                  {friends.map(friend => (
                    <label key={friend._id} className="friend-checkbox-item">
                      <input
                        type="checkbox"
                        checked={hiddenFromUsers.includes(friend._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setHiddenFromUsers([...hiddenFromUsers, friend._id]);
                            setSharedWithUsers(sharedWithUsers.filter(id => id !== friend._id));
                          } else {
                            setHiddenFromUsers(hiddenFromUsers.filter(id => id !== friend._id));
                          }
                        }}
                      />
                      <div className="friend-info">
                        <div className="friend-avatar-small">
                          {friend.profilePhoto ? (
                            <img src={getImageUrl(friend.profilePhoto)} alt={friend.displayName} />
                          ) : (
                            <span>{friend.displayName?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <span>{friend.displayName || friend.username}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="privacy-divider">OR</div>

              <div className="privacy-section">
                <h3>Share with specific friends only</h3>
                <p className="privacy-description">Only selected friends will see this post</p>
                <div className="friends-checklist">
                  {friends.map(friend => (
                    <label key={friend._id} className="friend-checkbox-item">
                      <input
                        type="checkbox"
                        checked={sharedWithUsers.includes(friend._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSharedWithUsers([...sharedWithUsers, friend._id]);
                            setHiddenFromUsers(hiddenFromUsers.filter(id => id !== friend._id));
                          } else {
                            setSharedWithUsers(sharedWithUsers.filter(id => id !== friend._id));
                          }
                        }}
                      />
                      <div className="friend-info">
                        <div className="friend-avatar-small">
                          {friend.profilePhoto ? (
                            <img src={getImageUrl(friend.profilePhoto)} alt={friend.displayName} />
                          ) : (
                            <span>{friend.displayName?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <span>{friend.displayName || friend.username}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => {
                setHiddenFromUsers([]);
                setSharedWithUsers([]);
                setShowPrivacyModal(false);
              }}>
                Clear All
              </button>
              <button className="btn-primary glossy-gold" onClick={() => setShowPrivacyModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        placeholder={modalState.placeholder}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={modalState.onConfirm}
        inputType={modalState.inputType}
        defaultValue={modalState.defaultValue}
      />

      <ShareModal
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal({ isOpen: false, post: null })}
        post={shareModal.post}
        onShare={handleShareComplete}
      />

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

export default Feed;
