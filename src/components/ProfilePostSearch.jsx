import { useState, useEffect } from 'react';
import axios from 'axios';
import './ProfilePostSearch.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ProfilePostSearch = ({ onResultsChange }) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [results, setResults] = useState({ posts: [], journals: [], longforms: [] });
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ posts: [], journals: [], longforms: [] });
      setShowResults(false);
      if (onResultsChange) onResultsChange(null);
      return;
    }

    const delaySearch = setTimeout(() => {
      searchPosts();
    }, 500); // Debounce search

    return () => clearTimeout(delaySearch);
  }, [query, activeTab]);

  const searchPosts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/search/my-posts`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: query, type: activeTab }
      });

      setResults(response.data);
      setShowResults(true);
      if (onResultsChange) onResultsChange(response.data);
    } catch (error) {
      console.error('Error searching posts:', error);
      setResults({ posts: [], journals: [], longforms: [] });
    } finally {
      setLoading(false);
    }
  };

  const getTotalCount = () => {
    return (results.posts?.length || 0) + 
           (results.journals?.length || 0) + 
           (results.longforms?.length || 0);
  };

  const clearSearch = () => {
    setQuery('');
    setResults({ posts: [], journals: [], longforms: [] });
    setShowResults(false);
    if (onResultsChange) onResultsChange(null);
  };

  return (
    <div className="profile-post-search">
      <div className="search-bar">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search your posts, journals, and longforms..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="profile-search-input"
          />
          {query && (
            <button className="clear-search-btn" onClick={clearSearch}>
              ✕
            </button>
          )}
        </div>
      </div>

      {showResults && (
        <div className="search-filters">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All ({getTotalCount()})
            </button>
            <button
              className={`filter-tab ${activeTab === 'post' ? 'active' : ''}`}
              onClick={() => setActiveTab('post')}
            >
              Posts ({results.posts?.length || 0})
            </button>
            <button
              className={`filter-tab ${activeTab === 'journal' ? 'active' : ''}`}
              onClick={() => setActiveTab('journal')}
            >
              Journals ({results.journals?.length || 0})
            </button>
            <button
              className={`filter-tab ${activeTab === 'longform' ? 'active' : ''}`}
              onClick={() => setActiveTab('longform')}
            >
              Longforms ({results.longforms?.length || 0})
            </button>
          </div>

          {loading && (
            <div className="search-status">Searching...</div>
          )}

          {!loading && getTotalCount() === 0 && (
            <div className="search-status">No results found for "{query}"</div>
          )}

          {!loading && getTotalCount() > 0 && (
            <div className="search-status">
              Found {getTotalCount()} {getTotalCount() === 1 ? 'result' : 'results'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfilePostSearch;

