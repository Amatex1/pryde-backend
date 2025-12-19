/**
 * PHASE 3: Longform Page
 * Longform creative posts for stories, essays, and articles
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { getCsrfToken } from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import Navbar from '../components/Navbar';
import DraftManager from '../components/DraftManager';
import './Longform.css';

function Longform() {
  const [longforms, setLongforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    coverImage: '',
    visibility: 'followers',
    tags: ''
  });
  const [showDraftManager, setShowDraftManager] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const autoSaveTimerRef = useRef(null);
  const currentUser = getCurrentUser();

  useEffect(() => {
    fetchLongforms();
  }, []);

  const fetchLongforms = async () => {
    try {
      setLoading(true);
      const userId = currentUser?._id || currentUser?.id;
      if (!userId) {
        console.error('No user ID found');
        setLoading(false);
        return;
      }
      const response = await api.get(`/longform/user/${userId}`);
      setLongforms(response.data);
    } catch (error) {
      console.error('Failed to fetch longforms:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-save draft
  const autoSaveDraft = useCallback(async () => {
    // Only auto-save if there's content
    if (!formData.body.trim() && !formData.title.trim()) return;

    // CRITICAL: Check if user is authenticated before attempting autosave
    const currentUser = getCurrentUser();
    if (!currentUser) {
      console.debug('⏸️ Skipping autosave - user not authenticated');
      return;
    }

    // CRITICAL: Check if CSRF token exists before attempting autosave
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      console.debug('⏸️ Skipping autosave - CSRF token not yet available');
      return;
    }

    try {
      const tagsArray = formData.tags ? formData.tags.split(',').map(t => t.trim()) : [];

      const draftData = {
        draftId: currentDraftId,
        draftType: 'longform',
        title: formData.title,
        body: formData.body,
        coverImage: formData.coverImage,
        visibility: formData.visibility,
        tags: tagsArray
      };

      const response = await api.post('/drafts', draftData);

      // Set draft ID if this is a new draft
      if (!currentDraftId && response.data._id) {
        setCurrentDraftId(response.data._id);
      }
    } catch (error) {
      console.error('Failed to auto-save draft:', error);
    }
  }, [formData, currentDraftId]);

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveDraft();
    }, 3000); // Auto-save after 3 seconds of inactivity

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, autoSaveDraft]);

  // Restore draft
  const handleRestoreDraft = (draft) => {
    const tagsString = draft.tags ? draft.tags.join(', ') : '';

    setFormData({
      title: draft.title || '',
      body: draft.body || '',
      coverImage: draft.coverImage || '',
      visibility: draft.visibility || 'followers',
      tags: tagsString
    });
    setCurrentDraftId(draft._id);
    setShowCreateForm(true);
  };

  // Delete draft after successful post
  const deleteDraft = async (draftId) => {
    if (!draftId) return;
    try {
      await api.delete(`/drafts/${draftId}`);
    } catch (error) {
      console.error('Failed to delete draft:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.body.trim()) {
      alert('Title and body are required');
      return;
    }

    try {
      const tagsArray = formData.tags ? formData.tags.split(',').map(t => t.trim()) : [];

      await api.post('/longform', {
        title: formData.title,
        body: formData.body,
        coverImage: formData.coverImage || null,
        visibility: formData.visibility,
        tags: tagsArray
      });

      // Delete draft after successful post
      if (currentDraftId) {
        await deleteDraft(currentDraftId);
        setCurrentDraftId(null);
      }

      setFormData({ title: '', body: '', coverImage: '', visibility: 'followers', tags: '' });
      setShowCreateForm(false);
      fetchLongforms();
    } catch (error) {
      console.error('Failed to create longform:', error);
      alert('Failed to create longform post');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      await api.delete(`/longform/${id}`);
      fetchLongforms();
    } catch (error) {
      console.error('Failed to delete longform:', error);
      alert('Failed to delete post');
    }
  };

  return (
    <>
      <Navbar />
      <div className="longform-container">
        <div className="longform-header">
          <h1>📝 My Longform Posts</h1>
          <p className="longform-subtitle">Share your stories, essays, and creative writing</p>
          <div className="longform-header-actions">
            <button
              className="btn-drafts"
              onClick={() => setShowDraftManager(true)}
              title="View saved drafts"
            >
              📝 Drafts
            </button>
            <button
              className="btn-create-longform glossy-gold"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? '✕ Cancel' : '✍️ New Post'}
            </button>
          </div>
        </div>

      {showCreateForm && (
        <div className="longform-create-form glossy">
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="longform-title-input"
              required
            />
            
            <textarea
              placeholder="Write your story..."
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              className="longform-body-input"
              rows="15"
              required
            />

            <div className="longform-form-footer">
              <select
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                className="longform-visibility-select"
              >
                <option value="followers">👥 Connections</option>
                <option value="public">🌍 Public</option>
                <option value="private">🔒 Private</option>
              </select>

              <button type="submit" className="btn-submit-longform glossy-gold">
                Publish
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="longforms-list">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : longforms.length === 0 ? (
          <div className="empty-state">
            <p>No longform posts yet. Start writing!</p>
          </div>
        ) : (
          longforms.map(longform => (
            <div key={longform._id} className="longform-card glossy">
              <div className="longform-card-header">
                <h3>{longform.title}</h3>
                <span className="longform-date">{new Date(longform.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="longform-preview">{longform.body.substring(0, 300)}...</p>
              <div className="longform-card-footer">
                <span className="longform-read-time">📖 {longform.readTime} min read</span>
                <span className="longform-visibility">
                  {longform.visibility === 'private' ? '🔒' : longform.visibility === 'followers' ? '👥' : '🌍'}
                </span>
                <button onClick={() => handleDelete(longform._id)} className="btn-delete">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Draft Manager Modal */}
      {showDraftManager && (
        <div className="modal-overlay" onClick={() => setShowDraftManager(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <DraftManager
              draftType="longform"
              onRestoreDraft={handleRestoreDraft}
              onClose={() => setShowDraftManager(false)}
            />
          </div>
        </div>
      )}
      </div>
    </>
  );
}

export default Longform;

