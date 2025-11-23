import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import './Profile.css';

function Profile() {
  const { id } = useParams();
  const currentUser = getCurrentUser();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isOwnProfile = currentUser?.id === id;

  useEffect(() => {
    fetchUserProfile();
  }, [id]);

  const fetchUserProfile = async () => {
    try {
      const response = await api.get(`/users/${id}`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-container">
        <Navbar />
        <div className="error">User not found</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar />
      
      <div className="profile-container">
        <div className="profile-header glossy fade-in">
          <div className="cover-photo">
            {user.coverPhoto ? (
              <img src={user.coverPhoto} alt="Cover" />
            ) : (
              <div className="cover-placeholder shimmer"></div>
            )}
          </div>

          <div className="profile-info">
            <div className="profile-avatar">
              {user.profilePhoto ? (
                <img src={user.profilePhoto} alt={user.username} />
              ) : (
                <span>{user.displayName?.charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="profile-details">
              <h1 className="profile-name text-shadow">
                {user.displayName || user.fullName || user.username}
                {user.nickname && <span className="nickname"> "{user.nickname}"</span>}
              </h1>
              <p className="profile-username">@{user.username}</p>

              <div className="profile-badges">
                {user.pronouns && user.pronouns !== 'Prefer Not to Say' && (
                  <span className="badge">
                    {user.pronouns === 'Custom' ? user.customPronouns : user.pronouns}
                  </span>
                )}
                {user.gender && user.gender !== 'Prefer Not to Say' && (
                  <span className="badge">
                    {user.gender === 'Custom' ? user.customGender : user.gender}
                  </span>
                )}
                {user.relationshipStatus && user.relationshipStatus !== 'Prefer Not to Say' && (
                  <span className="badge">
                    {user.relationshipStatus === 'Single' && '💔'}
                    {user.relationshipStatus === 'Taken' && '💕'}
                    {user.relationshipStatus === 'Married' && '💍'}
                    {user.relationshipStatus === "It's Complicated" && '😅'}
                    {user.relationshipStatus === 'Looking for Friends' && '👋'}
                    {' '}{user.relationshipStatus}
                  </span>
                )}
              </div>

              {user.bio && <p className="profile-bio">{user.bio}</p>}

              <div className="profile-meta">
                {user.location && (
                  <span className="meta-item">📍 {user.location}</span>
                )}
                {user.website && (
                  <a href={user.website} target="_blank" rel="noopener noreferrer" className="meta-item">
                    🔗 {user.website}
                  </a>
                )}
              </div>

              {user.socialLinks && user.socialLinks.length > 0 && (
                <div className="social-links">
                  <h3 className="social-title">Social Links</h3>
                  <div className="social-grid">
                    {user.socialLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="social-link-item glossy"
                      >
                        <span className="social-platform">{link.platform}</span>
                        <span className="social-icon">→</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="profile-stats">
                <div className="stat-item">
                  <span className="stat-value">{user.friends?.length || 0}</span>
                  <span className="stat-label">Friends</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">0</span>
                  <span className="stat-label">Posts</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-content">
          <div className="profile-posts">
            <h2 className="section-title">Posts</h2>
            <div className="empty-state glossy">
              <p>No posts yet</p>
            </div>
          </div>

          <div className="profile-sidebar">
            <div className="sidebar-card glossy">
              <h3 className="sidebar-title">Friends</h3>
              {user.friends && user.friends.length > 0 ? (
                <div className="friends-grid">
                  {user.friends.slice(0, 6).map((friend) => (
                    <div key={friend._id} className="friend-item">
                      <div className="friend-avatar">
                        {friend.profilePhoto ? (
                          <img src={friend.profilePhoto} alt={friend.username} />
                        ) : (
                          <span>{friend.displayName?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="friend-name">{friend.displayName}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-text">No friends yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
