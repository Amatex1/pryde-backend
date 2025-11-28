import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
import './Bookmarks.css';

const Bookmarks = () => {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      const response = await api.get('/bookmarks');
      setBookmarks(response.data.bookmarks || []);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBookmark = async (postId) => {
    try {
      await api.delete(`/bookmarks/${postId}`);
      setBookmarks(bookmarks.filter(post => post._id !== postId));
    } catch (error) {
      console.error('Error removing bookmark:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="bookmarks-container">
          <div className="bookmarks-header">
            <h1>📚 Bookmarks</h1>
          </div>
          <div className="loading">Loading bookmarks...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />
      <div className="bookmarks-container">
        <div className="bookmarks-header">
          <h1>📚 Bookmarks</h1>
          <p className="bookmarks-subtitle">Posts you've saved for later</p>
        </div>

        {bookmarks.length === 0 ? (
          <div className="no-bookmarks">
            <div className="no-bookmarks-icon">🔖</div>
            <h2>No bookmarks yet</h2>
            <p>Save posts to read them later</p>
          </div>
        ) : (
          <div className="bookmarks-grid">
            {bookmarks.map(post => (
              <div key={post._id} className="bookmark-card">
                <div className="bookmark-header">
                  <div className="bookmark-author" onClick={() => navigate(`/profile/${post.author._id}`)}>
                    <img
                      src={getImageUrl(post.author.profilePhoto) || '/default-avatar.png'}
                      alt={post.author.displayName}
                      className="author-avatar"
                    />
                  <div className="author-info">
                    <span className="author-name">{post.author.displayName}</span>
                    <span className="author-username">@{post.author.username}</span>
                  </div>
                </div>
                <button 
                  className="remove-bookmark-btn"
                  onClick={() => handleRemoveBookmark(post._id)}
                  title="Remove bookmark"
                >
                  🗑️
                </button>
              </div>

              <div className="bookmark-content" onClick={() => navigate(`/post/${post._id}`)}>
                <p className="post-content">{post.content}</p>
                {post.images && post.images.length > 0 && (
                  <div className="post-images">
                    {post.images.map((img, idx) => (
                      <img key={idx} src={img} alt="Post" className="post-image" />
                    ))}
                  </div>
                )}
              </div>

              <div className="bookmark-footer">
                <span className="post-date">{formatDate(post.createdAt)}</span>
                <div className="post-stats">
                  <span>❤️ {post.likes?.length || 0}</span>
                  <span>💬 {post.comments?.length || 0}</span>
                  <span>🔄 {post.shares?.length || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

export default Bookmarks;

