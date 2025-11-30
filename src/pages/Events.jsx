import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import './Events.css';

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const currentUser = getCurrentUser();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventType: 'in-person',
    category: 'social',
    startDate: '',
    endDate: '',
    venue: '',
    address: '',
    city: '',
    country: '',
    virtualLink: '',
    coverImage: '',
    maxAttendees: '',
    isPrivate: false,
    tags: ''
  });

  useEffect(() => {
    fetchEvents();
  }, [filterCategory, filterType]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.append('category', filterCategory);
      if (filterType !== 'all') params.append('type', filterType);
      
      const response = await api.get(`/events?${params.toString()}`);
      setEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const eventData = {
        title: formData.title,
        description: formData.description,
        eventType: formData.eventType,
        category: formData.category,
        startDate: formData.startDate,
        endDate: formData.endDate,
        location: {
          venue: formData.venue,
          address: formData.address,
          city: formData.city,
          country: formData.country,
          virtualLink: formData.virtualLink
        },
        coverImage: formData.coverImage,
        maxAttendees: formData.maxAttendees ? parseInt(formData.maxAttendees) : null,
        isPrivate: formData.isPrivate,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };

      await api.post('/events', eventData);
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        eventType: 'in-person',
        category: 'social',
        startDate: '',
        endDate: '',
        venue: '',
        address: '',
        city: '',
        country: '',
        virtualLink: '',
        coverImage: '',
        maxAttendees: '',
        isPrivate: false,
        tags: ''
      });
      fetchEvents();
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('Failed to create event. Please try again.');
    }
  };

  const handleRSVP = async (eventId, status) => {
    try {
      await api.post(`/events/${eventId}/rsvp`, { status });
      fetchEvents();
    } catch (error) {
      console.error('Failed to RSVP:', error);
      alert(error.response?.data?.message || 'Failed to RSVP. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAttendeeCount = (event, status) => {
    return event.attendees?.filter(a => a.status === status).length || 0;
  };

  const getUserRSVP = (event) => {
    return event.attendees?.find(a => a.user._id === currentUser?.id || a.user._id === currentUser?._id);
  };

  const categoryEmojis = {
    pride: '≡ƒÅ│∩╕ÅΓÇì≡ƒîê',
    'support-group': '≡ƒñ¥',
    social: '≡ƒÄë',
    activism: 'Γ£è',
    education: '≡ƒôÜ',
    arts: '≡ƒÄ¿',
    sports: 'ΓÜ╜',
    other: '≡ƒôî'
  };

  const typeEmojis = {
    'in-person': '≡ƒôì',
    virtual: '≡ƒÆ╗',
    hybrid: '≡ƒöä'
  };

  return (
    <div className="events-page">
      <Navbar />
      <div className="events-container">
        <div className="events-header">
          <h1 className="page-title">≡ƒÅ│∩╕ÅΓÇì≡ƒîê LGBTQ+ Events</h1>
          <button className="btn-create-event" onClick={() => setShowCreateModal(true)}>
            Γ₧ò Create Event
          </button>
        </div>

        <div className="events-filters">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Categories</option>
            <option value="pride">≡ƒÅ│∩╕ÅΓÇì≡ƒîê Pride</option>
            <option value="support-group">≡ƒñ¥ Support Group</option>
            <option value="social">≡ƒÄë Social</option>
            <option value="activism">Γ£è Activism</option>
            <option value="education">≡ƒôÜ Education</option>
            <option value="arts">≡ƒÄ¿ Arts</option>
            <option value="sports">ΓÜ╜ Sports</option>
            <option value="other">≡ƒôî Other</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="in-person">≡ƒôì In-Person</option>
            <option value="virtual">≡ƒÆ╗ Virtual</option>
            <option value="hybrid">≡ƒöä Hybrid</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="no-events">
            <p>No events found. Be the first to create one!</p>
          </div>
        ) : (
          <div className="events-grid">
            {events.map(event => {
              const userRSVP = getUserRSVP(event);
              const goingCount = getAttendeeCount(event, 'going');
              const interestedCount = getAttendeeCount(event, 'interested');

              return (
                <div key={event._id} className="event-card">
                  {event.coverImage && (
                    <div className="event-cover">
                      <img src={getImageUrl(event.coverImage)} alt={event.title} />
                    </div>
                  )}
                  <div className="event-content">
                    <div className="event-badges">
                      <span className="event-badge category">
                        {categoryEmojis[event.category]} {event.category}
                      </span>
                      <span className="event-badge type">
                        {typeEmojis[event.eventType]} {event.eventType}
                      </span>
                    </div>

                    <h3 className="event-title">{event.title}</h3>
                    <p className="event-description">{event.description}</p>

                    <div className="event-details">
                      <div className="event-detail">
                        <span className="detail-icon">≡ƒôà</span>
                        <span>{formatDate(event.startDate)}</span>
                      </div>
                      {event.eventType !== 'virtual' && event.location?.city && (
                        <div className="event-detail">
                          <span className="detail-icon">≡ƒôì</span>
                          <span>{event.location.city}, {event.location.country}</span>
                        </div>
                      )}
                      {event.eventType !== 'in-person' && event.location?.virtualLink && (
                        <div className="event-detail">
                          <span className="detail-icon">≡ƒÆ╗</span>
                          <a href={event.location.virtualLink} target="_blank" rel="noopener noreferrer">
                            Join Online
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="event-stats">
                      <span>{goingCount} going</span>
                      <span>{interestedCount} interested</span>
                    </div>

                    <div className="event-creator">
                      <Link to={`/profile/${event.creator?.username}`} className="creator-link">
                        {event.creator?.profilePhoto ? (
                          <img src={getImageUrl(event.creator.profilePhoto)} alt={event.creator.username} />
                        ) : (
                          <span>{event.creator?.displayName?.charAt(0) || 'U'}</span>
                        )}
                        <span>{event.creator?.displayName || event.creator?.username}</span>
                        {event.creator?.isVerified && <span className="verified-badge">Γ£ô</span>}
                      </Link>
                    </div>

                    <div className="event-actions">
                      {userRSVP?.status === 'going' ? (
                        <button className="btn-rsvp active" onClick={() => handleRSVP(event._id, 'not-going')}>
                          Γ£ô Going
                        </button>
                      ) : (
                        <button className="btn-rsvp" onClick={() => handleRSVP(event._id, 'going')}>
                          RSVP
                        </button>
                      )}
                      {userRSVP?.status === 'interested' ? (
                        <button className="btn-interested active" onClick={() => handleRSVP(event._id, 'not-going')}>
                          Γ¡É Interested
                        </button>
                      ) : (
                        <button className="btn-interested" onClick={() => handleRSVP(event._id, 'interested')}>
                          Interested
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Events;
