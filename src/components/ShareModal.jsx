import { useState, useEffect } from 'react';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
import './ShareModal.css';

function ShareModal({ isOpen, onClose, post, onShare }) {
  const [friends, setFriends] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [shareToFriendProfile, setShareToFriendProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shareTab, setShareTab] = useState('friends'); // 'friends' or 'groups'

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
      fetchGroupChats();
    }
  }, [isOpen]);

  const fetchFriends = async () => {
    try {
      const response = await api.get('/friends');
      // The endpoint returns the friends array directly, not wrapped in an object
      setFriends(response.data || []);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  const fetchGroupChats = async () => {
    try {
      const response = await api.get('/groupChats');
      setGroupChats(response.data || []);
    } catch (error) {
      console.error('Failed to fetch group chats:', error);
    }
  };

  const handleShare = async () => {
    setLoading(true);
    try {
      // Share to feed or friend's profile
      if (shareToFeed || shareToFriendProfile) {
        await api.post(`/posts/${post._id}/share`, {
          shareToFriendProfile: shareToFriendProfile
        });
      }

      // Create post link message
      const postLink = `${window.location.origin}/post/${post._id}`;
      const postPreview = post.content ? post.content.substring(0, 100) + (post.content.length > 100 ? '...' : '') : 'Check out this post!';
      const messageContent = `📌 Shared a post: ${postPreview}\n\n${postLink}`;

      // Send to selected friends via messages
      if (selectedFriends.length > 0) {
        await Promise.all(
          selectedFriends.map(friendId =>
            api.post('/messages', {
              recipient: friendId,
              content: messageContent
            })
          )
        );
      }

      // Send to selected group chats
      if (selectedGroups.length > 0) {
        await Promise.all(
          selectedGroups.map(groupId =>
            api.post('/messages', {
              groupChatId: groupId,
              content: messageContent
            })
          )
        );
      }

      onShare();
      onClose();
      // Reset selections
      setSelectedFriends([]);
      setSelectedGroups([]);
      setShareToFeed(true);
      setShareToFriendProfile(null);
    } catch (error) {
      console.error('Failed to share post:', error);
      alert('Failed to share post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFriend = (friendId) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const toggleGroup = (groupId) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  if (!isOpen || !post) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h2>Share Post</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="share-modal-body">
          {/* Post Preview */}
          <div className="post-preview">
            <h3>Post Preview</h3>
            <div className="preview-card">
              <div className="preview-author">
                {post.author?.profilePhoto && (
                  <img src={getImageUrl(post.author.profilePhoto)} alt={post.author.username} className="preview-avatar" />
                )}
                <div>
                  <div className="author-name">{post.author?.displayName || post.author?.username}</div>
                  <div className="post-date">{new Date(post.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
              <p className="preview-content">{post.content}</p>
              {post.media && post.media.length > 0 && (
                <div className="preview-media">
                  {post.media.slice(0, 2).map((media, idx) => (
                    <div key={idx} className="preview-media-item">
                      {media.type === 'image' ? (
                        <img src={getImageUrl(media.url)} alt="Post media" />
                      ) : (
                        <video src={getImageUrl(media.url)} />
                      )}
                    </div>
                  ))}
                  {post.media.length > 2 && <span className="more-media">+{post.media.length - 2} more</span>}
                </div>
              )}
            </div>
          </div>

          {/* Share Options */}
          <div className="share-options">
            <h3>Share To</h3>
            <label className="share-option">
              <input
                type="checkbox"
                checked={shareToFeed}
                onChange={(e) => {
                  setShareToFeed(e.target.checked);
                  if (e.target.checked) setShareToFriendProfile(null);
                }}
              />
              <span>📢 Share to my feed</span>
            </label>

            {/* Share to Friend's Profile */}
            <div className="share-to-friend-profile">
              <h4>Or share to a friend's profile:</h4>
              <select
                value={shareToFriendProfile || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setShareToFriendProfile(value || null);
                  if (value) setShareToFeed(false);
                }}
                className="friend-profile-select"
              >
                <option value="">Select a friend...</option>
                {friends.map(friend => (
                  <option key={friend._id} value={friend._id}>
                    {friend.displayName || friend.username}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Friend & Group Selection */}
          <div className="friend-selection">
            <h3>Send via Message (Optional)</h3>

            {/* Tabs */}
            <div className="share-tabs">
              <button
                className={`share-tab ${shareTab === 'friends' ? 'active' : ''}`}
                onClick={() => setShareTab('friends')}
              >
                👥 Friends ({selectedFriends.length})
              </button>
              <button
                className={`share-tab ${shareTab === 'groups' ? 'active' : ''}`}
                onClick={() => setShareTab('groups')}
              >
                💬 Groups ({selectedGroups.length})
              </button>
            </div>

            {/* Friends List */}
            {shareTab === 'friends' && (
              <div className="friends-list">
                {friends.length === 0 ? (
                  <p className="no-friends">No friends to share with</p>
                ) : (
                  friends.map(friend => (
                    <label key={friend._id} className="friend-item">
                      <input
                        type="checkbox"
                        checked={selectedFriends.includes(friend._id)}
                        onChange={() => toggleFriend(friend._id)}
                      />
                      <div className="friend-avatar">
                        {friend.profilePhoto ? (
                          <img src={getImageUrl(friend.profilePhoto)} alt={friend.displayName} />
                        ) : (
                          <span>{friend.displayName?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span>{friend.displayName || friend.username}</span>
                    </label>
                  ))
                )}
              </div>
            )}

            {/* Groups List */}
            {shareTab === 'groups' && (
              <div className="friends-list">
                {groupChats.length === 0 ? (
                  <p className="no-friends">No group chats to share with</p>
                ) : (
                  groupChats.map(group => (
                    <label key={group._id} className="friend-item">
                      <input
                        type="checkbox"
                        checked={selectedGroups.includes(group._id)}
                        onChange={() => toggleGroup(group._id)}
                      />
                      <div className="friend-avatar">
                        {group.avatar ? (
                          <img src={getImageUrl(group.avatar)} alt={group.name} />
                        ) : (
                          <span>{group.name?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span>{group.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="share-modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-share"
            onClick={handleShare}
            disabled={loading || (!shareToFeed && selectedFriends.length === 0 && selectedGroups.length === 0)}
          >
            {loading ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShareModal;

