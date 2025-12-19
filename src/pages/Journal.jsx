/**
 * PHASE 3: Journal Page
 * Personal journaling for reflection and creative expression
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { getCsrfToken } from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import Navbar from '../components/Navbar';
import DraftManager from '../components/DraftManager';
import './Journal.css';

function Journal() {
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    visibility: 'private',
    mood: '',
    tags: ''
  });
  const [showDraftManager, setShowDraftManager] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const autoSaveTimerRef = useRef(null);
  const currentUser = getCurrentUser();

  useEffect(() => {
    fetchJournals();
  }, []);

  const fetchJournals = async () => {
    try {
      setLoading(true);
      const response = await api.get('/journals/me');
      setJournals(response.data);
    } catch (error) {
      console.error('Failed to fetch journals:', error);
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
        draftType: 'journal',
        title: formData.title,
        body: formData.body,
        visibility: formData.visibility,
        mood: formData.mood,
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
      visibility: draft.visibility || 'private',
      mood: draft.mood || '',
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

    if (!formData.body.trim()) {
      alert('Journal body is required');
      return;
    }

    try {
      const tagsArray = formData.tags ? formData.tags.split(',').map(t => t.trim()) : [];

      await api.post('/journals', {
        title: formData.title || null,
        body: formData.body,
        visibility: formData.visibility,
        mood: formData.mood || null,
        tags: tagsArray
      });

      // Delete draft after successful post
      if (currentDraftId) {
        await deleteDraft(currentDraftId);
        setCurrentDraftId(null);
      }

      setFormData({ title: '', body: '', visibility: 'private', mood: '', tags: '' });
      setShowCreateForm(false);
      fetchJournals();
    } catch (error) {
      console.error('Failed to create journal:', error);
      alert('Failed to create journal entry');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this journal entry?')) {
      return;
    }

    try {
      await api.delete(`/journals/${id}`);
      fetchJournals();
    } catch (error) {
      console.error('Failed to delete journal:', error);
      alert('Failed to delete journal entry');
    }
  };

  return (
    <>
      <Navbar />
      <div className="journal-container">
        <div className="journal-header">
          <h1>📔 My Journal</h1>
          <p className="journal-subtitle">A private space for your thoughts and reflections</p>
          <div className="journal-header-actions">
            <button
              className="btn-drafts"
              onClick={() => setShowDraftManager(true)}
              title="View saved drafts"
            >
              📝 Drafts
            </button>
            <button
              className="btn-create-journal glossy-gold"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? '✕ Cancel' : '✍️ New Entry'}
            </button>
          </div>
        </div>

      {showCreateForm && (
        <div className="journal-create-form glossy">
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Title (optional)"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="journal-title-input"
            />
            
            <textarea
              placeholder="Write your thoughts..."
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              className="journal-body-input"
              rows="10"
              required
            />

            <div className="journal-form-footer">
              <select
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                className="journal-visibility-select"
              >
                <option value="private">🔒 Private</option>
                <option value="followers">👥 Connections</option>
                <option value="public">🌍 Public</option>
              </select>

              <select
                value={formData.mood}
                onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                className="journal-mood-select"
              >
                <option value="">Mood (optional)</option>
                <option value="happy">😊 Happy</option>
                <option value="sad">😢 Sad</option>
                <option value="anxious">😰 Anxious</option>
                <option value="calm">😌 Calm</option>
                <option value="excited">🤩 Excited</option>
                <option value="reflective">🤔 Reflective</option>
                <option value="grateful">🙏 Grateful</option>
              </select>

              <button type="submit" className="btn-submit-journal glossy-gold">
                Save Entry
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="journals-list">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : journals.length === 0 ? (
          <div className="empty-state">
            <p>No journal entries yet. Start writing!</p>
          </div>
        ) : (
          journals.map(journal => (
            <div key={journal._id} className="journal-card glossy">
              <div className="journal-card-header">
                {journal.title && <h3>{journal.title}</h3>}
                <span className="journal-date">{new Date(journal.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="journal-preview">{journal.body.substring(0, 200)}...</p>
              <div className="journal-card-footer">
                <span className="journal-visibility">
                  {journal.visibility === 'private' ? '🔒' : journal.visibility === 'followers' ? '👥' : '🌍'}
                </span>
                {journal.mood && <span className="journal-mood">{journal.mood}</span>}
                <button onClick={() => handleDelete(journal._id)} className="btn-delete">Delete</button>
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
              draftType="journal"
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

export default Journal;

