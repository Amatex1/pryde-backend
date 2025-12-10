import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './MessageSearch.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MessageSearch = ({ conversationWith = null }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const delaySearch = setTimeout(() => {
      searchMessages();
    }, 500); // Debounce search

    return () => clearTimeout(delaySearch);
  }, [query, conversationWith]);

  const searchMessages = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = { q: query };
      if (conversationWith) {
        params.conversationWith = conversationWith;
      }

      const response = await axios.get(`${API_URL}/api/search/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setResults(response.data.messages || []);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching messages:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const highlightText = (text, query) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <mark key={index} className="highlight">{part}</mark> : 
        part
    );
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 24) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="message-search">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search messages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="message-search-input"
        />
        {query && (
          <button 
            className="clear-search-btn"
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowResults(false);
            }}
          >
            ✕
          </button>
        )}
      </div>

      {showResults && (
        <div className="search-results">
          {loading ? (
            <div className="search-loading">Searching...</div>
          ) : results.length === 0 ? (
            <div className="no-results">No messages found</div>
          ) : (
            <div className="results-list">
              <div className="results-header">
                {results.length} {results.length === 1 ? 'result' : 'results'} found
              </div>
              {results.map((message) => {
                const otherUser = message.sender._id === localStorage.getItem('userId') 
                  ? message.recipient 
                  : message.sender;

                return (
                  <div key={message._id} className="search-result-item">
                    <Link to={`/messages/${otherUser._id}`} className="result-user">
                      <img 
                        src={otherUser.profilePhoto || '/default-avatar.png'} 
                        alt={otherUser.username}
                        className="result-avatar"
                      />
                      <span className="result-username">@{otherUser.username}</span>
                    </Link>
                    <div className="result-message">
                      {highlightText(message.content, query)}
                    </div>
                    <div className="result-date">{formatDate(message.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageSearch;

