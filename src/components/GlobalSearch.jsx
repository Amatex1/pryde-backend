import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
import './GlobalSearch.css';

function GlobalSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ users: [], posts: [], hashtags: [] });
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        performSearch();
      } else {
        setSearchResults({ users: [], posts: [], hashtags: [] });
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (userId) => {
    navigate(`/profile/${userId}`);
    setShowResults(false);
    setSearchQuery('');
  };

  const handleHashtagClick = (hashtag) => {
    navigate(`/hashtag/${hashtag.replace('#', '')}`);
    setShowResults(false);
    setSearchQuery('');
  };

  const handlePostClick = (postId) => {
    navigate(`/feed?post=${postId}`);
    setShowResults(false);
    setSearchQuery('');
  };

  const hasResults = searchResults.users.length > 0 || 
                     searchResults.posts.length > 0 || 
                     searchResults.hashtags.length > 0;

  return (
    <div className="global-search" ref={searchRef}>
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchQuery && setShowResults(true)}
          placeholder="Search users, posts, hashtags..."
          className="search-input"
        />
        {loading && <span className="search-loading">⏳</span>}
      </div>

      {showResults && (
        <div className="search-results-dropdown">
          {!hasResults && !loading && (
            <div className="no-search-results">No results found</div>
          )}

          {searchResults.hashtags.length > 0 && (
            <div className="search-section">
              <div className="search-section-title">Hashtags</div>
              {searchResults.hashtags.map((item, index) => (
                <div
                  key={index}
                  className="search-result-item hashtag-item"
                  onClick={() => handleHashtagClick(item.hashtag)}
                >
                  <span className="hashtag-icon">#</span>
                  <div className="hashtag-info">
                    <div className="hashtag-name">{item.hashtag}</div>
                    <div className="hashtag-count">{item.count} posts</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchResults.users.length > 0 && (
            <div className="search-section">
              <div className="search-section-title">Users</div>
              {searchResults.users.map((user) => (
                <div
                  key={user._id}
                  className="search-result-item user-item"
                  onClick={() => handleUserClick(user._id)}
                >
                  <div className="user-avatar-small">
                    {user.profilePhoto ? (
                      <img src={getImageUrl(user.profilePhoto)} alt={user.displayName} />
                    ) : (
                      <span>{user.displayName?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="user-info">
                    <div className="user-name">{user.displayName || user.username}</div>
                    <div className="user-username">@{user.username}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchResults.posts.length > 0 && (
            <div className="search-section">
              <div className="search-section-title">Posts</div>
              {searchResults.posts.slice(0, 5).map((post) => (
                <div
                  key={post._id}
                  className="search-result-item post-item"
                  onClick={() => handlePostClick(post._id)}
                >
                  <div className="post-preview">
                    <div className="post-author-small">
                      {post.author?.displayName || post.author?.username}
                    </div>
                    <div className="post-content-preview">
                      {post.content?.substring(0, 100)}
                      {post.content?.length > 100 && '...'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;

