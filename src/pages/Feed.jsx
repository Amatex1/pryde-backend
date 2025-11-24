import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ReportModal from '../components/ReportModal';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import './Feed.css';

function Feed() {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingPosts, setFetchingPosts] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [reportModal, setReportModal] = useState({ isOpen: false, type: '', contentId: null, userId: null });
  const [blockedUsers, setBlockedUsers] = useState([]);
  const currentUser = getCurrentUser();

  useEffect(() => {
    fetchPosts();
    fetchBlockedUsers();
  }, []);

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
      const response = await api.post('/posts', {
        content: newPost,
        media: selectedMedia,
        visibility: 'public'
      });
      setPosts([response.data, ...posts]);
      setNewPost('');
      setSelectedMedia([]);
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

  const handleComment = async (postId) => {
    const content = prompt('Enter your comment:');
    if (!content || !content.trim()) return;

    try {
      const response = await api.post(`/posts/${postId}/comment`, { content });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
    } catch (error) {
      console.error('Failed to comment:', error);
      alert('Failed to add comment. Please try again.');
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
      <Navbar />
      
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
                        <video src={media.url} controls />
                      ) : (
                        <img src={media.url} alt={`Upload ${index + 1}`} />
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
                      {post.content && <p>{post.content}</p>}

                      {post.media && post.media.length > 0 && (
                        <div className={`post-media-grid ${post.media.length === 1 ? 'single' : post.media.length === 2 ? 'double' : 'multiple'}`}>
                          {post.media.map((media, index) => (
                            <div key={index} className="post-media-item">
                              {media.type === 'video' ? (
                                <video src={media.url} controls />
                              ) : (
                                <img src={media.url} alt={`Post media ${index + 1}`} />
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
                        onClick={() => handleComment(post._id)}
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
                        {post.comments.slice(-3).map((comment) => (
                          <div key={comment._id} className="comment">
                            <div className="comment-avatar">
                              {comment.user?.profilePhoto ? (
                                <img src={comment.user.profilePhoto} alt={comment.user.username} />
                              ) : (
                                <span>{comment.user?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                              )}
                            </div>
                            <div className="comment-content">
                              <div className="comment-author">{comment.user?.displayName || comment.user?.username}</div>
                              <div className="comment-text">{comment.content}</div>
                            </div>
                          </div>
                        ))}
                      </div>
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
              <div className="trending-item">#PrydeSocial</div>
              <div className="trending-item">#ConnectWithFriends</div>
              <div className="trending-item">#SocialNetwork</div>
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
    </div>
  );
}

export default Feed;
