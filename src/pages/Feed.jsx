import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import './Feed.css';

function Feed() {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingPosts, setFetchingPosts] = useState(true);
  const currentUser = getCurrentUser();

  useEffect(() => {
    fetchPosts();
  }, []);

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

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    setLoading(true);
    try {
      const response = await api.post('/posts', {
        content: newPost,
        visibility: 'public'
      });
      setPosts([response.data, ...posts]);
      setNewPost('');
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
              <button type="submit" disabled={loading} className="btn-post glossy-gold">
                {loading ? 'Posting...' : 'Share Post ✨'}
              </button>
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
              posts.map((post) => {
                const isLiked = post.likes?.some(like =>
                  (typeof like === 'string' ? like : like._id) === (currentUser?.id || currentUser?._id)
                );

                return (
                  <div key={post._id} className="post-card glossy fade-in">
                    <div className="post-header">
                      <div className="post-author">
                        <div className="author-avatar">
                          {post.author?.profilePhoto ? (
                            <img src={post.author.profilePhoto} alt={post.author.username} />
                          ) : (
                            <span>{post.author?.displayName?.charAt(0).toUpperCase() || post.author?.username?.charAt(0).toUpperCase() || 'U'}</span>
                          )}
                        </div>
                        <div className="author-info">
                          <div className="author-name">{post.author?.displayName || post.author?.username || 'User'}</div>
                          <div className="post-time">{new Date(post.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                      {(post.author?._id === currentUser?.id || post.author?._id === currentUser?._id) && (
                        <button
                          className="btn-delete"
                          onClick={() => handleDelete(post._id)}
                          title="Delete post"
                        >
                          🗑️
                        </button>
                      )}
                    </div>

                    <div className="post-content">
                      <p>{post.content}</p>
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
    </div>
  );
}

export default Feed;
