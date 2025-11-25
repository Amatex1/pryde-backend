import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ReportModal from '../components/ReportModal';
import PhotoViewer from '../components/PhotoViewer';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import './Feed.css';

function Feed({ onOpenMiniChat }) {
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
  const [postVisibility, setPostVisibility] = useState('friends');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [hiddenFromUsers, setHiddenFromUsers] = useState([]);
  const [sharedWithUsers, setSharedWithUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [trending, setTrending] = useState([]);
  const currentUser = getCurrentUser();

  useEffect(() => {
    fetchPosts();
    fetchBlockedUsers();
    fetchFriends();
    fetchTrending();
  }, []);

  const fetchFriends = async () => {
    try {
      const response = await api.get('/friends');
      setFriends(response.data);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
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
      alert('Please select only images (JPEG, PNG, GIF) or videos (MP4, WebM, OGG)');
      return;
    }

    // Limit to 10 files
    if (selectedMedia.length + files.length > 10) {
      alert('You can only upload up to 10 media files per post');
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
      alert('Failed to upload media. Please try again.');
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
      alert('Please add some content or media to your post');
      return;
    }

    setLoading(true);
    try {
      const postData = {
        content: newPost,
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
      alert('Failed to create post. Please try again.');
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
      const response = await api.post(`/posts/${postId}/comment`, { content });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setCommentText(prev => ({ ...prev, [postId]: '' }));
    } catch (error) {
      console.error('Failed to comment:', error);
      alert('Failed to add comment. Please try again.');
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
      alert('Failed to edit comment. Please try again.');
    }
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await api.delete(`/posts/${postId}/comment/${commentId}`);
      setPosts(posts.map(p => p._id === postId ? response.data : p));
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert('Failed to delete comment. Please try again.');
    }
  };

  const handleShare = async (postId) => {
    try {
      const response = await api.post(`/posts/${postId}/share`);
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      alert('Post shared successfully!');
    } catch (error) {
      console.error('Failed to share post:', error);
      alert(error.response?.data?.message || 'Failed to share post.');
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      await api.delete(`/posts/${postId}`);
      setPosts(posts.filter(p => p._id !== postId));
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post. Please try again.');
    }
  };

  return (
    <div className="page-container">
      <Navbar onOpenMiniChat={onOpenMiniChat} />
      
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
                  <div key={post._id} className="post-card glossy fade-in">
                    <div className="post-header">
                      <div className="post-author">
                        <div className="author-avatar">
                          {post.author?.profilePhoto ? (
                            <img src={getImageUrl(post.author.profilePhoto)} alt={post.author.username} />
                          ) : (
                            <span>{post.author?.displayName?.charAt(0).toUpperCase() || post.author?.username?.charAt(0).toUpperCase() || 'U'}</span>
                          )}
                        </div>
                        <div className="author-info">
                          <div className="author-name">{post.author?.displayName || post.author?.username || 'User'}</div>
                          <div className="post-time">{new Date(post.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="post-header-actions">
                        {(post.author?._id === currentUser?.id || post.author?._id === currentUser?._id) ? (
                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(post._id)}
                            title="Delete post"
                          >
                            🗑️
                          </button>
                        ) : (
                          <button
                            className="btn-report"
                            onClick={() => setReportModal({ isOpen: true, type: 'post', contentId: post._id, userId: post.author?._id })}
                            title="Report post"
                          >
                            🚩
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="post-content">
                      {post.content && (
                        <p>
                          {post.content.split(' ').map((word, index) =>
                            word.startsWith('#') ? (
                              <Link key={index} to={`/hashtag/${word.substring(1)}`} className="hashtag-link">
                                {word}{' '}
                              </Link>
                            ) : (
                              <span key={index}>{word} </span>
                            )
                          )}
                        </p>
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
                    </div>

                    <div className="post-actions">
                      <button
                        className={`action-btn ${isLiked ? 'liked' : ''}`}
                        onClick={() => handleLike(post._id)}
                      >
                        <span>{isLiked ? '❤️' : '🤍'}</span> Like ({post.likes?.length || 0})
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => toggleCommentBox(post._id)}
                      >
                        <span>💬</span> Comment ({post.comments?.length || 0})
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => handleShare(post._id)}
                      >
                        <span>🔗</span> Share ({post.shares?.length || 0})
                      </button>
                    </div>

                    {post.comments && post.comments.length > 0 && (
                      <div className="post-comments">
                        {post.comments.slice(-3).map((comment) => {
                          const isEditing = editingCommentId === comment._id;
                          const isOwnComment = comment.user?._id === currentUser?._id;

                          return (
                            <div key={comment._id} className="comment">
                              <div className="comment-avatar">
                                {comment.user?.profilePhoto ? (
                                  <img src={getImageUrl(comment.user.profilePhoto)} alt={comment.user.username} />
                                ) : (
                                  <span>{comment.user?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                                )}
                              </div>
                              <div className="comment-content">
                                <div className="comment-author">{comment.user?.displayName || comment.user?.username}</div>

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
                                    <div className="comment-text">
                                      {comment.content}
                                      {comment.edited && <span className="edited-indicator"> (edited)</span>}
                                    </div>
                                    {isOwnComment && (
                                      <div className="comment-actions">
                                        <button
                                          onClick={() => handleEditComment(comment._id, comment.content)}
                                          className="btn-comment-action"
                                          title="Edit comment"
                                        >
                                          ✏️ Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteComment(post._id, comment._id)}
                                          className="btn-comment-action"
                                          title="Delete comment"
                                        >
                                          🗑️ Delete
                                        </button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
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

        <div className="feed-sidebar">
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
    </div>
  );
}

export default Feed;
