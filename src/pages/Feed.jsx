import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import './Feed.css';

function Feed() {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In a real app, you'd fetch posts from the backend
    // For now, we'll show a welcome message
    setPosts([
      {
        id: 1,
        author: { displayName: 'Pryde Social', username: 'pryde', profilePhoto: '' },
        content: 'Welcome to Pryde Social! Start connecting with friends and sharing your moments. ✨',
        createdAt: new Date().toISOString(),
        likes: 0
      }
    ]);
  }, []);

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    setLoading(true);
    try {
      // In a real app, you'd post to the backend
      const post = {
        id: Date.now(),
        content: newPost,
        createdAt: new Date().toISOString(),
        likes: 0
      };
      setPosts([post, ...posts]);
      setNewPost('');
    } catch (error) {
      console.error('Post creation failed:', error);
    } finally {
      setLoading(false);
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
            {posts.map((post) => (
              <div key={post.id} className="post-card glossy fade-in">
                <div className="post-header">
                  <div className="post-author">
                    <div className="author-avatar">
                      {post.author?.profilePhoto ? (
                        <img src={post.author.profilePhoto} alt={post.author.username} />
                      ) : (
                        <span>{post.author?.displayName?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="author-info">
                      <div className="author-name">{post.author?.displayName || 'User'}</div>
                      <div className="post-time">{new Date(post.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
                
                <div className="post-content">
                  <p>{post.content}</p>
                </div>

                <div className="post-actions">
                  <button className="action-btn">
                    <span>❤️</span> Like ({post.likes})
                  </button>
                  <button className="action-btn">
                    <span>💬</span> Comment
                  </button>
                  <button className="action-btn">
                    <span>🔗</span> Share
                  </button>
                </div>
              </div>
            ))}
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
