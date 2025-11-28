import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CustomModal from '../components/CustomModal';
import { useModal } from '../hooks/useModal';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
import {
  onFriendRequestReceived,
  onFriendRequestAccepted,
  emitFriendRequestSent,
  emitFriendRequestAccepted
} from '../utils/socket';
import './Friends.css';

function Friends({ onOpenMiniChat }) {
  const { modalState, closeModal, showAlert } = useModal();
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]); // Track sent friend requests
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/auth/me');
        setCurrentUser(response.data);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (activeTab === 'friends') {
      fetchFriends();
    } else if (activeTab === 'requests') {
      fetchRequests();
    } else if (activeTab === 'pending') {
      fetchSentRequests();
    }
  }, [activeTab]);

  // Real-time friend request notifications
  useEffect(() => {
    // Listen for incoming friend requests
    onFriendRequestReceived((data) => {
      // Refresh requests list if on requests tab
      if (activeTab === 'requests') {
        fetchRequests();
      }
      // Show notification
      showNotification(`New friend request from ${data.senderUsername}`);
    });

    // Listen for accepted friend requests
    onFriendRequestAccepted((data) => {
      // Refresh friends list if on friends tab
      if (activeTab === 'friends') {
        fetchFriends();
      }
      // Show notification
      showNotification(`${data.accepterUsername} accepted your friend request!`);
    });
  }, [activeTab]);

  const fetchFriends = async () => {
    try {
      const response = await api.get('/friends');
      setFriends(response.data);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await api.get('/friends/requests/pending');
      setRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  };

  const fetchSentRequests = async () => {
    try {
      const response = await api.get('/friends/requests/sent');
      setSentRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch sent requests:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await api.get(`/users/search?q=${searchQuery}`);
      setSearchResults(response.data);
      // Also fetch sent requests to check status
      await fetchSentRequests();
      await fetchFriends();
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message) => {
    // Create a simple notification
    const notif = document.createElement('div');
    notif.className = 'realtime-notification';
    notif.textContent = message;
    document.body.appendChild(notif);
    
    setTimeout(() => {
      notif.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notif.classList.remove('show');
      setTimeout(() => notif.remove(), 300);
    }, 3000);
  };

  const handleSendRequest = async (userId) => {
    try {
      await api.post(`/friends/request/${userId}`);

      // Emit real-time notification to recipient
      if (currentUser) {
        emitFriendRequestSent({
          recipientId: userId,
          senderId: currentUser._id || currentUser.id,
          senderUsername: currentUser.username,
          senderPhoto: currentUser.profilePhoto
        });
      }

      // Refresh sent requests to update button state
      await fetchSentRequests();
      alert('Friend request sent!');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to send request');
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const request = requests.find(r => r._id === requestId);
      await api.post(`/friends/accept/${requestId}`);

      // Emit real-time notification to requester
      if (currentUser && request) {
        emitFriendRequestAccepted({
          recipientId: request.sender._id,
          accepterId: currentUser._id || currentUser.id,
          accepterUsername: currentUser.username,
          accepterPhoto: currentUser.profilePhoto
        });
      }

      fetchRequests();
      fetchFriends();
      alert('Friend request accepted!');
    } catch (error) {
      alert('Failed to accept request');
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      await api.post(`/friends/decline/${requestId}`);
      fetchRequests();
    } catch (error) {
      alert('Failed to decline request');
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;

    try {
      await api.delete(`/friends/${friendId}`);
      fetchFriends();
    } catch (error) {
      alert('Failed to remove friend');
    }
  };

  return (
    <div className="page-container">
      <Navbar onOpenMiniChat={onOpenMiniChat} />
      
      <div className="friends-container">
        <div className="friends-header glossy fade-in">
          <h1 className="page-title text-shadow">👥 Friends</h1>
          
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'friends' ? 'active' : ''}`}
              onClick={() => setActiveTab('friends')}
            >
              My Friends
            </button>
            <button
              className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              Requests ({requests.length})
            </button>
            <button
              className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Pending ({sentRequests.length})
            </button>
            <button
              className={`tab ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              Find Friends
            </button>
          </div>
        </div>

        <div className="friends-content">
          {activeTab === 'friends' && (
            <div className="friends-list fade-in">
              {friends.length > 0 ? (
                <div className="user-grid">
                  {friends.map((friend) => (
                    <div
                      key={friend._id}
                      className={`user-card glossy ${friend.isActive === false ? 'deactivated-user' : ''}`}
                    >
                      {friend.isActive === false ? (
                        <div
                          className="user-link deactivated-link"
                          onClick={() => showAlert('This user has deactivated their account.', 'Account Deactivated')}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="user-avatar deactivated-avatar">
                            <span>?</span>
                          </div>
                          <div className="user-info">
                            <div className="user-name deactivated-text">{friend.displayName || friend.username}</div>
                            <div className="user-username deactivated-text">@{friend.username}</div>
                            {friend.bio && <div className="user-bio deactivated-text">{friend.bio}</div>}
                          </div>
                        </div>
                      ) : (
                        <Link to={`/profile/${friend._id}`} className="user-link">
                          <div className="user-avatar">
                            {friend.profilePhoto ? (
                              <img src={getImageUrl(friend.profilePhoto)} alt={friend.username} />
                            ) : (
                              <span>{friend.displayName?.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="user-info">
                            <div className="user-name">{friend.displayName || friend.username}</div>
                            <div className="user-username">@{friend.username}</div>
                            {friend.bio && <div className="user-bio">{friend.bio}</div>}
                          </div>
                        </Link>
                      )}
                      <button
                        onClick={() => handleRemoveFriend(friend._id)}
                        className="btn-remove"
                      >
                        Remove Friend
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state glossy">
                  <p>No friends yet. Start connecting with people!</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="requests-list fade-in">
              {requests.length > 0 ? (
                <div className="user-grid">
                  {requests.map((request) => (
                    <div key={request._id} className="user-card glossy">
                      <Link to={`/profile/${request.sender._id}`} className="user-link">
                        <div className="user-avatar">
                          {request.sender.profilePhoto ? (
                            <img src={getImageUrl(request.sender.profilePhoto)} alt={request.sender.username} />
                          ) : (
                            <span>{request.sender.displayName?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{request.sender.displayName || request.sender.username}</div>
                          <div className="user-username">@{request.sender.username}</div>
                        </div>
                      </Link>
                      <div className="request-actions">
                        <button
                          onClick={() => handleAcceptRequest(request._id)}
                          className="btn-accept glossy-gold"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(request._id)}
                          className="btn-decline"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state glossy">
                  <p>No pending friend requests</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pending' && (
            <div className="pending-list fade-in">
              {sentRequests.length > 0 ? (
                <div className="user-grid">
                  {sentRequests.map((request) => (
                    <div key={request._id} className="user-card glossy">
                      <Link to={`/profile/${request.receiver._id}`} className="user-link">
                        <div className="user-avatar">
                          {request.receiver.profilePhoto ? (
                            <img src={getImageUrl(request.receiver.profilePhoto)} alt={request.receiver.username} />
                          ) : (
                            <span>{request.receiver.displayName?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{request.receiver.displayName || request.receiver.username}</div>
                          <div className="user-username">@{request.receiver.username}</div>
                        </div>
                      </Link>
                      <button className="btn-pending" disabled>
                        ⏳ Pending
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state glossy">
                  <p>No pending friend requests sent</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="search-section fade-in">
              <form onSubmit={handleSearch} className="search-form glossy">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for users..."
                  className="search-input glossy"
                />
                <button type="submit" disabled={loading} className="btn-search glossy-gold">
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="user-grid">
                  {searchResults.map((user) => {
                    // Check if already friends
                    const isFriend = friends.some(f => f._id === user._id);
                    // Check if request already sent
                    const requestSent = sentRequests.some(r => r.receiver._id === user._id);
                    // Check if request received
                    const requestReceived = requests.some(r => r.sender._id === user._id);

                    return (
                      <div key={user._id} className="user-card glossy">
                        <Link to={`/profile/${user._id}`} className="user-link">
                          <div className="user-avatar">
                            {user.profilePhoto ? (
                              <img src={getImageUrl(user.profilePhoto)} alt={user.username} />
                            ) : (
                              <span>{user.displayName?.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="user-info">
                            <div className="user-name">{user.displayName || user.username}</div>
                            <div className="user-username">@{user.username}</div>
                            {user.bio && <div className="user-bio">{user.bio}</div>}
                          </div>
                        </Link>
                        {isFriend ? (
                          <button className="btn-friends" disabled>
                            Friends ✓
                          </button>
                        ) : requestSent ? (
                          <button className="btn-pending" disabled>
                            Pending
                          </button>
                        ) : requestReceived ? (
                          <button className="btn-respond" onClick={() => setActiveTab('requests')}>
                            Respond
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(user._id)}
                            className="btn-add glossy-gold"
                          >
                            Add Friend
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CustomModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
      />
    </div>
  );
}

export default Friends;
