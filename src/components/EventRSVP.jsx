import { useState } from 'react';
import api from '../utils/api';
import './EventRSVP.css';

const EventRSVP = ({ event, currentUserId, onRSVPChange }) => {
  const [loading, setLoading] = useState(false);

  // Find current user's RSVP status
  const currentUserRSVP = event.attendees?.find(
    a => (a.user === currentUserId || a.user?._id === currentUserId)
  );
  const currentStatus = currentUserRSVP?.status || null;

  // Count attendees by status
  const goingCount = event.attendees?.filter(a => a.status === 'going').length || 0;
  const interestedCount = event.attendees?.filter(a => a.status === 'interested').length || 0;

  const handleRSVP = async (status) => {
    if (loading) return;

    // If clicking the same status, remove RSVP
    const newStatus = currentStatus === status ? 'not-going' : status;

    setLoading(true);
    try {
      const response = await api.post(`/events/${event._id}/rsvp`, { status: newStatus });

      if (onRSVPChange) {
        onRSVPChange(response.data);
      }
    } catch (error) {
      console.error('Error updating RSVP:', error);
      alert(error.response?.data?.message || 'Failed to update RSVP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="event-rsvp">
      <div className="rsvp-buttons">
        <button
          className={`rsvp-btn going ${currentStatus === 'going' ? 'active' : ''}`}
          onClick={() => handleRSVP('going')}
          disabled={loading}
        >
          <span className="rsvp-icon">✓</span>
          <span className="rsvp-label">Going</span>
          {goingCount > 0 && <span className="rsvp-count">{goingCount}</span>}
        </button>

        <button
          className={`rsvp-btn interested ${currentStatus === 'interested' ? 'active' : ''}`}
          onClick={() => handleRSVP('interested')}
          disabled={loading}
        >
          <span className="rsvp-icon">⭐</span>
          <span className="rsvp-label">Interested</span>
          {interestedCount > 0 && <span className="rsvp-count">{interestedCount}</span>}
        </button>
      </div>
    </div>
  );
};

export default EventRSVP;

