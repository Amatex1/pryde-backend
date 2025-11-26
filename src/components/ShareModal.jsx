import { useState, useEffect } from 'react';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
import './ShareModal.css';

function ShareModal({ isOpen, onClose, post, onShare }) {
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [shareToFeed, setShareToFeed] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchFriends();
    }
  }, [isOpen]);

  const fetchFriends = async () => {
    try {
      const response = await api.get('/friends');
      setFriends(response.data.friends || []);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  const handleShare = async () => {
    setLoading(true);
    try {
      // Share to feed
      if (shareToFeed) {
        await api.post(`/posts/${post._id}/share`);
      }

      // Send to selected friends (future feature - would need messaging integration)
      if (selectedFriends.length > 0) {
        // TODO: Implement sending post to specific friends via messages
        console.log('Sharing with friends:', selectedFriends);
      }

      onShare();
      onClose();
    } catch (error) {
      console.error('Failed to share post:', error);
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
                onChange={(e) => setShareToFeed(e.target.checked)}
              />
              <span>📢 Share to my feed</span>
            </label>
          </div>

          {/* Friend Selection */}
          <div className="friend-selection">
            <h3>Send to Friends (Optional)</h3>
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
          </div>
        </div>

        <div className="share-modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-share"
            onClick={handleShare}
            disabled={loading || (!shareToFeed && selectedFriends.length === 0)}
          >
            {loading ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShareModal;

