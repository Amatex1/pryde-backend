import { useState, useEffect } from 'react';
import axios from 'axios';
import './DraftManager.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const DraftManager = ({ draftType, onRestoreDraft, onClose }) => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDrafts();
  }, [draftType]);

  const fetchDrafts = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = draftType ? { type: draftType } : {};
      
      const response = await axios.get(`${API_URL}/api/drafts`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setDrafts(response.data.drafts || []);
    } catch (error) {
      console.error('Error fetching drafts:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteDraft = async (draftId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/drafts/${draftId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setDrafts(drafts.filter(d => d._id !== draftId));
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  const getDraftPreview = (draft) => {
    if (draft.content) return draft.content.substring(0, 100);
    if (draft.title) return draft.title;
    if (draft.body) return draft.body.substring(0, 100);
    return 'Untitled draft';
  };

  const getDraftTypeLabel = (type) => {
    const labels = {
      post: 'Post',
      journal: 'Journal',
      longform: 'Longform',
      photoEssay: 'Photo Essay'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="draft-manager">
        <div className="draft-manager-header">
          <h3>Drafts</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="draft-loading">Loading drafts...</div>
      </div>
    );
  }

  return (
    <div className="draft-manager">
      <div className="draft-manager-header">
        <h3>Drafts</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      {drafts.length === 0 ? (
        <div className="no-drafts">
          <p>No drafts saved</p>
        </div>
      ) : (
        <div className="draft-list">
          {drafts.map(draft => (
            <div key={draft._id} className="draft-item">
              <div className="draft-type-badge">{getDraftTypeLabel(draft.draftType)}</div>
              <div className="draft-content">
                <p className="draft-preview">{getDraftPreview(draft)}</p>
                <span className="draft-time">{formatDate(draft.lastAutoSaved)}</span>
              </div>
              <div className="draft-actions">
                <button 
                  className="restore-btn"
                  onClick={() => {
                    onRestoreDraft(draft);
                    onClose();
                  }}
                >
                  Restore
                </button>
                <button 
                  className="delete-btn"
                  onClick={() => {
                    if (window.confirm('Delete this draft?')) {
                      deleteDraft(draft._id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DraftManager;

