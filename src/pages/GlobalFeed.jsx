/**
 * PHASE 2: Global Feed - Chronological feed of all public posts
 * Slow, calm UX with no algorithmic ranking
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import Navbar from '../components/Navbar';
import './GlobalFeed.css';
import './Feed.css';

function GlobalFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const currentUser = getCurrentUser();

  useEffect(() => {
    fetchGlobalFeed();
  }, []);

  const fetchGlobalFeed = async (before = null) => {
    try {
      setLoading(true);
      const params = { limit: 20 };
      if (before) {
        params.before = before;
      }

      const response = await api.get('/feed/global', { params });
      const newPosts = response.data;

      if (before) {
        setPosts(prev => [...prev, ...newPosts]);
      } else {
        setPosts(newPosts);
      }

      setHasMore(newPosts.length === 20);
    } catch (error) {
      console.error('Failed to fetch global feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (posts.length > 0 && hasMore && !loading) {
      const lastPost = posts[posts.length - 1];
      fetchGlobalFeed(lastPost.createdAt);
    }
  };

  const handleLike = async (postId) => {
    try {
      await api.post(`/posts/${postId}/like`);
      setPosts(posts.map(post => 
        post._id === postId 
          ? { ...post, hasLiked: !post.hasLiked }
          : post
      ));
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  if (loading && posts.length === 0) {
    return (
      <>
        <Navbar />
        <div className="global-feed-container">
          <div className="feed-header">
            <h1>🌟 Discover</h1>
            <p className="feed-subtitle">Explore posts from the entire community</p>
          </div>
          <div className="loading">Loading...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="global-feed-container">
        <div className="feed-header">
          <h1>🌟 Discover</h1>
          <p className="feed-subtitle">Explore posts from the entire community</p>
        </div>

      <div className="posts-list">
        {posts.map(post => (
          <div key={post._id} className="post-card glossy">
            <div className="post-header">
              <Link to={`/profile/${post.author?.username}`} className="post-author">
                <div className="author-avatar">
                  {post.author?.profilePhoto ? (
                    <img src={getImageUrl(post.author.profilePhoto)} alt={post.author.username} />
                  ) : (
                    <span>{post.author?.displayName?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="author-info">
                  <span className="author-name">
                    {post.author?.displayName}
                    {post.author?.isVerified && <span className="verified-badge">✓</span>}
                  </span>
                  <span className="post-time">{new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            </div>

            <div className="post-content">
              <p>{post.content}</p>
              {post.media && post.media.length > 0 && (
                <div className="post-media">
                  {post.media.map((item, index) => (
                    item.type === 'image' ? (
                      <img key={index} src={getImageUrl(item.url)} alt="Post media" />
                    ) : (
                      <video key={index} src={getImageUrl(item.url)} controls />
                    )
                  ))}
                </div>
              )}
            </div>

            <div className="post-actions">
              <button 
                className={`btn-action ${post.hasLiked ? 'liked' : ''}`}
                onClick={() => handleLike(post._id)}
              >
                {post.hasLiked ? '❤️' : '🤍'} React
              </button>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button onClick={loadMore} className="btn-load-more" disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
      </div>
    </>
  );
}

export default GlobalFeed;

