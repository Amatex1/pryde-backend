/**
 * PHASE 4: Discover Page
 * Community tags for discovery and browsing
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './Discover.css';

function Discover() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tags');
      setTags(response.data);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTagClick = (slug) => {
    navigate(`/tags/${slug}`);
  };

  return (
    <div className="discover-container">
      <div className="discover-header">
        <h1>🌟 Discover Communities</h1>
        <p className="discover-subtitle">Find your space and connect with like-minded people</p>
      </div>

      {loading ? (
        <div className="loading">Loading communities...</div>
      ) : (
        <div className="tags-grid">
          {tags.map(tag => (
            <div 
              key={tag._id} 
              className="tag-card glossy"
              onClick={() => handleTagClick(tag.slug)}
            >
              <div className="tag-icon">{tag.icon}</div>
              <h3 className="tag-label">{tag.label}</h3>
              <p className="tag-description">{tag.description}</p>
              <div className="tag-stats">
                <span className="tag-post-count">{tag.postCount} posts</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Discover;

