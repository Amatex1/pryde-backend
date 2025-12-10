import { useState } from 'react';
import { Link } from 'react-router-dom';
import CustomModal from './CustomModal';
import './EventAttendees.css';

const EventAttendees = ({ attendees }) => {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('going');

  const goingAttendees = attendees?.filter(a => a.status === 'going') || [];
  const interestedAttendees = attendees?.filter(a => a.status === 'interested') || [];

  const totalCount = goingAttendees.length + interestedAttendees.length;

  if (totalCount === 0) {
    return null;
  }

  const displayAttendees = activeTab === 'going' ? goingAttendees : interestedAttendees;

  return (
    <>
      <button className="view-attendees-btn" onClick={() => setShowModal(true)}>
        <span className="attendees-icon">👥</span>
        <span className="attendees-text">
          {totalCount} {totalCount === 1 ? 'person' : 'people'} interested
        </span>
      </button>

      <CustomModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Event Attendees"
      >
        <div className="event-attendees-modal">
          <div className="attendees-tabs">
            <button
              className={`attendees-tab ${activeTab === 'going' ? 'active' : ''}`}
              onClick={() => setActiveTab('going')}
            >
              Going ({goingAttendees.length})
            </button>
            <button
              className={`attendees-tab ${activeTab === 'interested' ? 'active' : ''}`}
              onClick={() => setActiveTab('interested')}
            >
              Interested ({interestedAttendees.length})
            </button>
          </div>

          <div className="attendees-list">
            {displayAttendees.length === 0 ? (
              <div className="no-attendees">
                No {activeTab} attendees yet
              </div>
            ) : (
              displayAttendees.map((attendee) => {
                const user = attendee.user;
                if (!user) return null;

                return (
                  <Link
                    key={user._id || user}
                    to={`/profile/${user.username || user._id}`}
                    className="attendee-item"
                    onClick={() => setShowModal(false)}
                  >
                    <img
                      src={user.profilePhoto || '/default-avatar.png'}
                      alt={user.displayName || user.username}
                      className="attendee-avatar"
                    />
                    <div className="attendee-info">
                      <div className="attendee-name">
                        {user.displayName || user.username}
                      </div>
                      <div className="attendee-username">@{user.username}</div>
                    </div>
                    <div className={`attendee-status ${attendee.status}`}>
                      {attendee.status === 'going' ? '✓' : '⭐'}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </CustomModal>
    </>
  );
};

export default EventAttendees;

