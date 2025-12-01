/**
 * PHASE 4: Discover Page
 * Community tags for discovery and browsing
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import Navbar from '../components/Navbar';
import './Discover.css';

function Discover() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', description: '', icon: '🏷️' });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

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

  // Check if user is admin or super_admin
  const isAdmin = currentUser && ['admin', 'super_admin'].includes(currentUser.role);

  const openCreateModal = () => {
    setShowCreateModal(true);
    setCreateError('');
    setCreateSuccess('');
    setNewTag({ name: '', description: '', icon: '🏷️' });
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateError('');
    setCreateSuccess('');
    setNewTag({ name: '', description: '', icon: '🏷️' });
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');

    // Validate name
    if (!newTag.name.trim()) {
      setCreateError('Tag name is required');
      return;
    }

    if (newTag.name.length > 40) {
      setCreateError('Tag name must be 40 characters or less');
      return;
    }

    // Validate description
    if (newTag.description && newTag.description.length > 200) {
      setCreateError('Tag description must be 200 characters or less');
      return;
    }

    // Validate name format
    const nameRegex = /^[a-zA-Z0-9\s-]+$/;
    if (!nameRegex.test(newTag.name)) {
      setCreateError('Tag name can only contain letters, numbers, spaces, and hyphens');
      return;
    }

    try {
      const response = await api.post('/tags/create', {
        name: newTag.name.trim(),
        description: newTag.description.trim(),
        icon: newTag.icon
      });

      if (response.data.success) {
        setCreateSuccess('Tag created successfully!');
        // Refresh tag list
        await fetchTags();
        // Close modal after 1 second
        setTimeout(() => {
          closeCreateModal();
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
      setCreateError(error.response?.data?.message || 'Failed to create tag');
    }
  };

  const handleIconSelect = (emoji) => {
    setNewTag({ ...newTag, icon: emoji });
  };

  // Expanded emoji icons for tags (60+ options organized by category)
  const commonIcons = [
    // Pride & Identity
    '🏳️‍🌈', '🏳️‍⚧️', '💖', '💜', '💙', '💚', '🧡', '❤️', '💛', '🤍', '🖤', '🤎',
    // Nature & Symbols
    '🌈', '✨', '🌟', '💫', '⭐', '🌙', '☀️', '🌸', '🌺', '🌻', '🌹', '🌷', '🦋', '🐝', '🌿', '🍀',
    // Activities & Hobbies
    '🎨', '📸', '📚', '🎵', '🎭', '🎬', '🎮', '🎲', '🧩', '✍️', '📝', '🖊️', '🖌️', '🎸', '🎹', '🎤',
    // Emotions & Expressions
    '😊', '🥰', '😌', '🤔', '💭', '💬', '🗨️', '💡', '🧠', '🫶', '👋', '✌️', '🤝', '💪',
    // Wellness & Self-Care
    '🧘', '🧘‍♀️', '🧘‍♂️', '💆', '💆‍♀️', '💆‍♂️', '🛀', '☕', '🍵', '🕯️', '🔥',
    // Misc & Fun
    '🏷️', '📌', '🔖', '🎯', '🎪', '🎨', '🌍', '🌎', '🌏', '🗺️', '🧭', '🔮', '🎁', '🎉', '🎊'
  ];

  return (
    <>
      <Navbar />
      <div className="discover-container">
        <div className="discover-header">
          <h1>🏷️ Community Tags</h1>
          <p className="discover-subtitle">Find your space and connect with like-minded people</p>
        </div>

        {/* Admin Create Tag Button */}
        {isAdmin && (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <button
              onClick={openCreateModal}
              className="btn-primary"
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, var(--pryde-purple), var(--electric-blue))',
                color: 'white',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>➕</span>
              Create New Tag
            </button>
          </div>
        )}

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

        {/* Create Tag Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={closeCreateModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h2>Create New Tag</h2>
                <button onClick={closeCreateModal} className="modal-close">×</button>
              </div>

              <form onSubmit={handleCreateTag} className="modal-body">
                {createError && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#fee',
                    color: '#c33',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.9rem'
                  }}>
                    {createError}
                  </div>
                )}

                {createSuccess && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#efe',
                    color: '#3c3',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.9rem'
                  }}>
                    {createSuccess}
                  </div>
                )}

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-main)' }}>
                    Tag Name <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={newTag.name}
                    onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                    placeholder="e.g., Queer Artists"
                    maxLength={40}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--border-light)',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {newTag.name.length}/40 characters
                  </small>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-main)' }}>
                    Description
                  </label>
                  <textarea
                    value={newTag.description}
                    onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                    placeholder="Brief description of this community tag"
                    maxLength={200}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--border-light)',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      resize: 'vertical'
                    }}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {newTag.description.length}/200 characters
                  </small>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-main)' }}>
                    Icon
                  </label>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{
                      fontSize: '3rem',
                      padding: '0.5rem',
                      background: 'var(--bg-light)',
                      borderRadius: '8px',
                      minWidth: '80px',
                      textAlign: 'center'
                    }}>
                      {newTag.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <small style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Select an icon from below
                      </small>
                    </div>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(10, 1fr)',
                    gap: '0.5rem',
                    padding: '1rem',
                    background: 'var(--bg-light)',
                    borderRadius: '8px',
                    maxHeight: '250px',
                    overflowY: 'auto'
                  }}>
                    {commonIcons.map((emoji, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleIconSelect(emoji)}
                        style={{
                          fontSize: '1.5rem',
                          padding: '0.5rem',
                          border: newTag.icon === emoji ? '2px solid var(--pryde-purple)' : '1px solid var(--border-light)',
                          borderRadius: '6px',
                          background: newTag.icon === emoji ? 'var(--soft-lavender)' : 'var(--card-surface)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    style={{
                      padding: '0.75rem 1.5rem',
                      border: '1px solid var(--border-light)',
                      borderRadius: '6px',
                      background: 'var(--card-surface)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'var(--soft-lavender)'}
                    onMouseLeave={(e) => e.target.style.background = 'var(--card-surface)'}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.75rem 1.5rem',
                      border: 'none',
                      borderRadius: '6px',
                      background: 'linear-gradient(135deg, var(--pryde-purple), var(--electric-blue))',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Create Tag
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Discover;

