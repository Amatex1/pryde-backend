import { useState, useEffect } from 'react';
import axios from 'axios';
import CustomModal from './CustomModal';
import './EditHistoryModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const EditHistoryModal = ({ isOpen, onClose, postId, contentType = 'post' }) => {
  const [editHistory, setEditHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && postId) {
      fetchEditHistory();
    }
  }, [isOpen, postId]);

  const fetchEditHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = contentType === 'post' 
        ? `/api/posts/${postId}/edit-history`
        : contentType === 'journal'
        ? `/api/journals/${postId}/edit-history`
        : `/api/longform/${postId}/edit-history`;

      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setEditHistory(response.data.editHistory || []);
    } catch (error) {
      console.error('Error fetching edit history:', error);
    } finally {
      setLoading(false);
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
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title="Edit History">
      <div className="edit-history-modal">
        {loading ? (
          <div className="edit-history-loading">Loading edit history...</div>
        ) : editHistory.length === 0 ? (
          <div className="no-edit-history">
            <p>No edit history available</p>
          </div>
        ) : (
          <div className="edit-history-timeline">
            {editHistory.map((edit, index) => (
              <div key={index} className="edit-history-item">
                <div className="edit-history-marker">
                  <div className="edit-history-dot" />
                  {index < editHistory.length - 1 && <div className="edit-history-line" />}
                </div>
                <div className="edit-history-content">
                  <div className="edit-history-header">
                    <span className="edit-history-time">{formatDate(edit.editedAt)}</span>
                    {edit.editedBy && (
                      <span className="edit-history-editor">
                        by @{edit.editedBy.username || 'Unknown'}
                      </span>
                    )}
                  </div>
                  <div className="edit-history-text">
                    {edit.content || edit.body || edit.title || 'No content'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CustomModal>
  );
};

export default EditHistoryModal;

