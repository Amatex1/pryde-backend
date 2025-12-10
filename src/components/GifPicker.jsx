import React, { useState, useRef, useEffect } from 'react';
import './GifPicker.css';

const GifPicker = ({ onGifSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('trending');
  const pickerRef = useRef(null);

  // Tenor API key - using public demo key (replace with your own in production)
  const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';
  const TENOR_CLIENT_KEY = 'pryde_social';

  const categories = [
    { id: 'trending', label: '🔥 Trending', search: '' },
    { id: 'happy', label: '😊 Happy', search: 'happy' },
    { id: 'love', label: '❤️ Love', search: 'love' },
    { id: 'laugh', label: '😂 Laugh', search: 'laugh' },
    { id: 'sad', label: '😢 Sad', search: 'sad' },
    { id: 'excited', label: '🎉 Excited', search: 'excited' },
    { id: 'dance', label: '💃 Dance', search: 'dance' },
    { id: 'thumbs', label: '👍 Thumbs Up', search: 'thumbs up' },
  ];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Load trending GIFs on mount
  useEffect(() => {
    fetchTrendingGifs();
  }, []);

  const fetchTrendingGifs = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=20`
      );
      const data = await response.json();
      setGifs(data.results || []);
    } catch (error) {
      console.error('Error fetching trending GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query) => {
    if (!query.trim()) {
      fetchTrendingGifs();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=20`
      );
      const data = await response.json();
      setGifs(data.results || []);
    } catch (error) {
      console.error('Error searching GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    searchGifs(searchQuery);
  };

  const handleCategoryClick = (category) => {
    setSelectedCategory(category.id);
    setSearchQuery(category.search);
    if (category.search) {
      searchGifs(category.search);
    } else {
      fetchTrendingGifs();
    }
  };

  const handleGifClick = (gif) => {
    // Get the medium quality GIF URL
    const gifUrl = gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url;
    if (gifUrl) {
      onGifSelect(gifUrl);
      onClose();
    }
  };

  return (
    <div className="gif-picker-overlay">
      <div className="gif-picker" ref={pickerRef}>
        <div className="gif-picker-header">
          <h4>Choose a GIF</h4>
          <button className="gif-picker-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSearch} className="gif-search-form">
          <input
            type="text"
            placeholder="Search GIFs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="gif-search-input"
          />
          <button type="submit" className="gif-search-btn">🔍</button>
        </form>

        <div className="gif-categories">
          {categories.map(category => (
            <button
              key={category.id}
              className={`gif-category-btn ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => handleCategoryClick(category)}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="gif-grid">
          {loading ? (
            <div className="gif-loading">Loading GIFs...</div>
          ) : gifs.length > 0 ? (
            gifs.map((gif) => (
              <div
                key={gif.id}
                className="gif-item"
                onClick={() => handleGifClick(gif)}
              >
                <img
                  src={gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url}
                  alt={gif.content_description || 'GIF'}
                  loading="lazy"
                />
              </div>
            ))
          ) : (
            <div className="gif-no-results">No GIFs found</div>
          )}
        </div>

        <div className="gif-picker-footer">
          <span>Powered by Tenor</span>
        </div>
      </div>
    </div>
  );
};

export default GifPicker;

