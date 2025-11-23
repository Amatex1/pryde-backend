import { useState } from 'react';
import api from '../utils/api';
import './ReportModal.css';

function ReportModal({ isOpen, onClose, reportType, contentId, userId }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons = [
    { value: 'spam', label: 'Spam or misleading' },
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'hate_speech', label: 'Hate speech or symbols' },
    { value: 'violence', label: 'Violence or dangerous organizations' },
    { value: 'nudity', label: 'Nudity or sexual content' },
    { value: 'misinformation', label: 'False information' },
    { value: 'impersonation', label: 'Impersonation' },
    { value: 'self_harm', label: 'Self-harm or suicide' },
    { value: 'other', label: 'Other' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!reason) {
      alert('Please select a reason');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/reports', {
        reportType,
        reportedContent: contentId,
        reportedUser: userId,
        reason,
        description
      });

      alert('Report submitted successfully. Thank you for helping keep Pryde Social safe.');
      onClose();
      setReason('');
      setDescription('');
    } catch (error) {
      console.error('Report submission error:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Report {reportType}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="report-form">
          <div className="form-group">
            <label>Why are you reporting this?</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="form-input"
              required
            >
              <option value="">Select a reason...</option>
              {reasons.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Additional details (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              rows="4"
              maxLength="1000"
              placeholder="Provide any additional context that might help us review this report..."
            />
            <small>{description.length}/1000</small>
          </div>

          <div className="report-info">
            <p>📋 Your report is anonymous and will be reviewed by our team.</p>
            <p>⚠️ False reports may result in action against your account.</p>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-submit">
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportModal;

