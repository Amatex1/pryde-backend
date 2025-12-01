/**
 * PHASE 4: Tag Feed Page
 * Shows posts for a specific community tag
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import './TagFeed.css';

function TagFeed() {
  const { slug } = useParams();
  const [tag, setTag] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchTagAndPosts();
  }, [slug]);

  const fetchTagAndPosts = async () => {
    try {
      setLoading(true);
      
      // Fetch tag details
      const tagResponse = await api.get(`/tags/${slug}`);
      setTag(tagResponse.data);
      
      // Fetch posts with this tag
      const postsResponse = await api.get(`/tags/${slug}/posts`);
      setPosts(postsResponse.data);
    } catch (error) {
      console.error('Failed to fetch tag feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      await api.post(`/posts/${postId}/like`);

      // Update local state
      setPosts(posts.map(post => {
        if (post._id === postId) {
          return { ...post, hasLiked: !post.hasLiked };
        }
        return post;
      }));
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    setPosting(true);
    try {
      const response = await api.post('/posts', {
        content: newPost,
        tags: [tag._id],
        visibility: 'public'
      });

      setPosts([response.data, ...posts]);
      setNewPost('');
    } catch (error) {
      console.error('Failed to create post:', error);
      alert('Failed to create post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!tag) {
    return <div className="error">Tag not found</div>;
  }

  return (
    <div className="tag-feed-container">
      <div className="tag-feed-header glossy">
        <div className="tag-feed-icon">{tag.icon}</div>
        <h1>{tag.label}</h1>
        <p className="tag-feed-description">{tag.description}</p>
        <div className="tag-feed-stats">
          <span>{tag.postCount} posts</span>
        </div>
      </div>

      {/* Create Post Box */}
      <div className="create-post glossy">
        <h2 className="section-title">✨ Share with {tag.label}</h2>
        <form onSubmit={handlePostSubmit}>
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder={`What would you like to share with ${tag.label}?`}
            className="post-input"
            rows="4"
          />
          <button
            type="submit"
            disabled={posting || !newPost.trim()}
            className="btn-post"
          >
            {posting ? 'Posting...' : 'Post ✨'}
          </button>
        </form>
      </div>

      <div className="tag-feed-posts">
        {posts.length === 0 ? (
          <div className="empty-state">
            <p>No posts in this community yet. Be the first to post!</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post._id} className="post-card glossy">
              <div className="post-header">
                <Link to={`/profile/${post.author._id}`} className="post-author">
                  <img 
                    src={post.author.profilePhoto || '/default-avatar.png'} 
                    alt={post.author.displayName}
                    className="author-avatar"
                  />
                  <div className="author-info">
                    <span className="author-name">
                      {post.author.displayName}
                      {post.author.isVerified && <span className="verified-badge">✓</span>}
                    </span>
                    <span className="post-date">{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              </div>

              <div className="post-content">
                <p>{post.content}</p>
                {post.images && post.images.length > 0 && (
                  <div className="post-images">
                    {post.images.map((img, idx) => (
                      <img key={idx} src={img} alt="Post" />
                    ))}
                  </div>
                )}
              </div>

              <div className="post-actions">
                <button 
                  className={`btn-action ${post.hasLiked ? 'liked' : ''}`}
                  onClick={() => handleLike(post._id)}
                >
                  {post.hasLiked ? '❤️' : '🤍'} Appreciate
                </button>
                <Link to={`/feed`} className="btn-action">
                  💬 Comment
                </Link>
              </div>

              {post.tags && post.tags.length > 0 && (
                <div className="post-tags">
                  {post.tags.map(t => (
                    <Link key={t._id} to={`/tags/${t.slug}`} className="post-tag">
                      {t.icon} {t.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TagFeed;

