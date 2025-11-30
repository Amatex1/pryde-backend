import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

function Friends() {
  const { modalState, closeModal, showAlert } = useModal();
  const [activeTab, setActiveTab] = useState('followers');
  const [friends, setFriends] = useState([]);
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]); // Track sent friend requests
  // New follow system states
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [followRequests, setFollowRequests] = useState([]);
  const [sentFollowRequests, setSentFollowRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
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

  // Fetch all counts when currentUser is available
  useEffect(() => {
    if (currentUser) {
      fetchFollowers();
      fetchFollowing();
      fetchFollowRequests();
      fetchSentFollowRequests();
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'friends') {
      fetchFriends();
    } else if (activeTab === 'requests') {
      fetchRequests();
    } else if (activeTab === 'pending') {
      fetchSentRequests();
    } else if (activeTab === 'followers') {
      fetchFollowers();
    } else if (activeTab === 'following') {
      fetchFollowing();
    } else if (activeTab === 'followRequests') {
      fetchFollowRequests();
    } else if (activeTab === 'search') {
      // Fetch suggested users when search tab is opened
      if (suggestedUsers.length === 0 && !searchQuery) {
        fetchSuggestedUsers();
      }
    }
  }, [activeTab]);

  // Real-time friend request notifications
  useEffect(() => {
    // Listen for incoming friend requests
    const cleanupReceived = onFriendRequestReceived((data) => {
      // Refresh requests list if on requests tab
      if (activeTab === 'requests') {
        fetchRequests();
      }
      // Show notification
      showNotification(`New friend request from ${data.senderUsername}`);
    });

    // Listen for accepted friend requests
    const cleanupAccepted = onFriendRequestAccepted((data) => {
      // Refresh friends list if on friends tab
      if (activeTab === 'friends') {
        fetchFriends();
      }
      // Show notification
      showNotification(`${data.accepterUsername} accepted your friend request!`);
    });

    // Cleanup listeners when component unmounts or activeTab changes
    return () => {
      cleanupReceived?.();
      cleanupAccepted?.();
    };
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

  // New follow system fetch functions
  const fetchFollowers = async () => {
    try {
      if (!currentUser) return;
      const userId = currentUser._id || currentUser.id;
      const response = await api.get(`/follow/followers/${userId}`);
      setFollowers(response.data.followers || []);
    } catch (error) {
      console.error('Failed to fetch followers:', error);
    }
  };

  const fetchFollowing = async () => {
    try {
      if (!currentUser) return;
      const userId = currentUser._id || currentUser.id;
      const response = await api.get(`/follow/following/${userId}`);
      setFollowing(response.data.following || []);
    } catch (error) {
      console.error('Failed to fetch following:', error);
    }
  };

  const fetchFollowRequests = async () => {
    try {
      const response = await api.get('/follow/requests');
      setFollowRequests(response.data.followRequests || []);
    } catch (error) {
      console.error('Failed to fetch follow requests:', error);
    }
  };

  const fetchSentFollowRequests = async () => {
    try {
      const response = await api.get('/follow/requests/sent');
      setSentFollowRequests(response.data.sentRequests || []);
    } catch (error) {
      console.error('Failed to fetch sent follow requests:', error);
    }
  };

  const fetchSuggestedUsers = async () => {
    setLoadingSuggestions(true);
    try {
      const response = await api.get('/users/suggested');
      setSuggestedUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch suggested users:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      // If search is empty, show suggested users
      fetchSuggestedUsers();
      setSearchResults([]);
      return;
    }

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

  // New follow system handlers
  const handleFollow = async (userId) => {
    try {
      const response = await api.post(`/follow/${userId}`);

      // Check if it was a follow or a follow request
      if (response.data.message === 'Follow request sent') {
        // Silently update sent requests list
        await fetchSentFollowRequests();
      } else {
        // Silently update following list
        await fetchFollowing();
      }

      // Refresh search results and suggested users to update button states
      if (searchQuery) {
        await handleSearch({ preventDefault: () => {} });
      } else {
        await fetchSuggestedUsers();
      }
    } catch (error) {
      // Only show error alerts
      alert(error.response?.data?.message || 'Failed to follow user');
    }
  };

  const handleUnfollow = async (userId) => {
    if (!confirm('Are you sure you want to unfollow this user?')) return;

    try {
      await api.delete(`/follow/${userId}`);
      await fetchFollowing();

      // Refresh search results and suggested users to update button states
      if (searchQuery) {
        await handleSearch({ preventDefault: () => {} });
      } else {
        await fetchSuggestedUsers();
      }

      // Silently update - no success alert
    } catch (error) {
      alert('Failed to unfollow user');
    }
  };

  const handleBlockUser = async (userId) => {
    if (!confirm('Are you sure you want to block this user? They will not be able to see your content or contact you.')) return;

    try {
      await api.post('/blocks', { blockedUserId: userId });
      // Remove from followers list after blocking
      fetchFollowers();
      // Silently update - no success alert
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to block user');
    }
  };

  const handleMessageUser = (userId) => {
    // Navigate to messages page with this user selected
    navigate(`/messages?user=${userId}`);
  };

  const handleAcceptFollowRequest = async (requestId) => {
    try {
      await api.post(`/follow/requests/${requestId}/accept`);
      fetchFollowRequests();
      fetchFollowers();
      // Silently update - no success alert
    } catch (error) {
      alert('Failed to accept follow request');
    }
  };

  const handleRejectFollowRequest = async (requestId) => {
    try {
      await api.post(`/follow/requests/${requestId}/reject`);
      fetchFollowRequests();
      // Silently update - no success alert
    } catch (error) {
      alert('Failed to reject follow request');
    }
  };

  return (
    <div className="page-container">
      <Navbar />
      
      <div className="friends-container">
        <div className="friends-header glossy fade-in">
          <h1 className="page-title text-shadow">👥 Connections</h1>

          <div className="tabs">
            <button
              className={`tab ${activeTab === 'followers' ? 'active' : ''}`}
              onClick={() => setActiveTab('followers')}
            >
              Followers ({followers.length})
            </button>
            <button
              className={`tab ${activeTab === 'following' ? 'active' : ''}`}
              onClick={() => setActiveTab('following')}
            >
              Following ({following.length})
            </button>
            <button
              className={`tab ${activeTab === 'followRequests' ? 'active' : ''}`}
              onClick={() => setActiveTab('followRequests')}
            >
              Requests ({followRequests.length})
            </button>
            <button
              className={`tab ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              Find People
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

          {/* New Follow System Tabs */}
          {activeTab === 'followers' && (
            <div className="followers-list fade-in">
              {followers.length > 0 ? (
                <div className="user-grid">
                  {followers.map((follower) => (
                    <div key={follower._id} className="user-card glossy">
                      {follower.coverPhoto && (
                        <div className="user-card-cover">
                          <img src={getImageUrl(follower.coverPhoto)} alt="Cover" />
                        </div>
                      )}
                      <Link to={`/profile/${follower._id}`} className="user-link">
                        <div className="user-avatar">
                          {follower.profilePhoto ? (
                            <img src={getImageUrl(follower.profilePhoto)} alt={follower.username} />
                          ) : (
                            <span>{follower.displayName?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{follower.displayName || follower.username}</div>
                          <div className="user-username">@{follower.username}</div>
                          {follower.bio && <div className="user-bio">{follower.bio}</div>}
                        </div>
                      </Link>
                      <div className="follower-actions">
                        <button
                          onClick={() => handleMessageUser(follower._id)}
                          className="btn-message"
                        >
                          💬 Message
                        </button>
                        <button
                          onClick={() => handleBlockUser(follower._id)}
                          className="btn-block"
                        >
                          🚫 Block
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state glossy">
                  <p>No followers yet. Share your profile to get followers!</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'following' && (
            <div className="following-list fade-in">
              {following.length > 0 ? (
                <div className="user-grid">
                  {following.map((user) => (
                    <div key={user._id} className="user-card glossy">
                      {user.coverPhoto && (
                        <div className="user-card-cover">
                          <img src={getImageUrl(user.coverPhoto)} alt="Cover" />
                        </div>
                      )}
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
                      <button
                        onClick={() => handleUnfollow(user._id)}
                        className="btn-remove"
                      >
                        Unfollow
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state glossy">
                  <p>Not following anyone yet. Find people to follow!</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'followRequests' && (
            <div className="follow-requests-list fade-in">
              {followRequests.length > 0 ? (
                <div className="user-grid">
                  {followRequests.map((request) => (
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
                          onClick={() => handleAcceptFollowRequest(request._id)}
                          className="btn-accept glossy-gold"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectFollowRequest(request._id)}
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
                  <p>No pending follow requests</p>
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

              {/* Show search results if available */}
              {searchResults.length > 0 && (
                <>
                  <h3 className="section-subtitle">Search Results</h3>
                  <div className="user-grid">
                    {searchResults.map((user) => {
                      // Check follow status
                      const isFollowing = following.some(f => f._id === user._id);
                      const isFollower = followers.some(f => f._id === user._id);
                      // Check if follow request pending (sent by me)
                      const requestPending = sentFollowRequests.some(r => r.receiver?._id === user._id);

                      return (
                        <div key={user._id} className="user-card glossy">
                          {user.coverPhoto && (
                            <div className="user-card-cover">
                              <img src={getImageUrl(user.coverPhoto)} alt="Cover" />
                            </div>
                          )}
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
                          {isFollowing ? (
                            <button className="btn-following" onClick={() => handleUnfollow(user._id)}>
                              ✓ Following
                            </button>
                          ) : requestPending ? (
                            <button className="btn-pending" disabled>
                              ⏳ Requested
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFollow(user._id)}
                              className="btn-add"
                            >
                              ➕ Follow
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Show suggested users when no search query */}
              {!searchQuery && suggestedUsers.length > 0 && (
                <>
                  <h3 className="section-subtitle">✨ Suggested For You</h3>
                  <p className="section-description">Based on your interests, location, and preferences</p>
                  <div className="user-grid">
                    {suggestedUsers.map((user) => {
                      const isFollowing = following.some(f => f._id === user._id);
                      const isFollower = followers.some(f => f._id === user._id);

                      return (
                        <div key={user._id} className="user-card glossy suggested-user">
                          {/* Cover Photo */}
                          {user.coverPhoto && (
                            <div className="user-card-cover">
                              <img src={getImageUrl(user.coverPhoto)} alt="Cover" />
                            </div>
                          )}

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

                              {/* Show match reasons */}
                              <div className="match-tags">
                                {user.interests && user.interests.length > 0 && currentUser?.interests?.some(i => user.interests.includes(i)) && (
                                  <span className="match-tag">🎯 Shared Interests</span>
                                )}
                                {user.city && currentUser?.city && user.city === currentUser.city && (
                                  <span className="match-tag">📍 Same City</span>
                                )}
                                {user.sexualOrientation && currentUser?.sexualOrientation && user.sexualOrientation === currentUser.sexualOrientation && (
                                  <span className="match-tag">🌈 Same Orientation</span>
                                )}
                              </div>
                            </div>
                          </Link>
                          {isFollowing ? (
                            <button className="btn-following" onClick={() => handleUnfollow(user._id)}>
                              ✓ Following
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFollow(user._id)}
                              className="btn-add"
                            >
                              ➕ Follow
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Loading state */}
              {loadingSuggestions && (
                <div className="empty-state glossy">
                  <p>Loading suggestions...</p>
                </div>
              )}

              {/* Empty state */}
              {!searchQuery && !loadingSuggestions && suggestedUsers.length === 0 && (
                <div className="empty-state glossy">
                  <p>No suggestions available. Try searching for users!</p>
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
