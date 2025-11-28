import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getImageUrl } from '../utils/imageUrl';
import './ReactionDetailsModal.css';

function ReactionDetailsModal({ reactions = [], likes = [], onClose }) {
  const [selectedTab, setSelectedTab] = useState('all');

  // Group reactions by emoji
  const reactionsByEmoji = reactions.reduce((acc, reaction) => {
    const emoji = reaction.emoji || '❤️';
    if (!acc[emoji]) {
      acc[emoji] = [];
    }
    acc[emoji].push(reaction);
    return acc;
  }, {});

  // Add likes as heart reactions if they exist
  if (likes && likes.length > 0) {
    if (!reactionsByEmoji['❤️']) {
      reactionsByEmoji['❤️'] = [];
    }
    likes.forEach(like => {
      // Only add if not already in reactions
      const alreadyReacted = reactions.some(r => 
        (r.user?._id || r.user) === (like._id || like)
      );
      if (!alreadyReacted) {
        reactionsByEmoji['❤️'].push({
          user: like,
          emoji: '❤️',
          createdAt: new Date()
        });
      }
    });
  }

  const allReactions = [
    ...reactions,
    ...likes.filter(like => {
      const alreadyReacted = reactions.some(r => 
        (r.user?._id || r.user) === (like._id || like)
      );
      return !alreadyReacted;
    }).map(like => ({
      user: like,
      emoji: '❤️',
      createdAt: new Date()
    }))
  ];

  const totalCount = allReactions.length;

  const displayReactions = selectedTab === 'all' 
    ? allReactions 
    : reactionsByEmoji[selectedTab] || [];

  return (
    <div className="reaction-modal-overlay" onClick={onClose}>
      <div className="reaction-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reaction-modal-header">
          <h3>Reactions</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="reaction-tabs">
          <button
            className={`reaction-tab ${selectedTab === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedTab('all')}
          >
            All {totalCount}
          </button>
          {Object.entries(reactionsByEmoji).map(([emoji, users]) => (
            <button
              key={emoji}
              className={`reaction-tab ${selectedTab === emoji ? 'active' : ''}`}
              onClick={() => setSelectedTab(emoji)}
            >
              {emoji} {users.length}
            </button>
          ))}
        </div>

        <div className="reaction-list">
          {displayReactions.length === 0 ? (
            <div className="no-reactions">
              <p>No reactions yet</p>
            </div>
          ) : (
            displayReactions.map((reaction, index) => {
              const user = reaction.user;

              // Handle both populated user objects and user IDs
              const isPopulated = user && typeof user === 'object' && user._id;
              const userId = isPopulated ? user._id : user;
              const username = isPopulated ? (user.username || 'Unknown User') : 'Unknown User';
              const displayName = isPopulated ? (user.displayName || username) : 'Unknown User';
              const profilePhoto = isPopulated ? user.profilePhoto : null;

              // Skip reactions from deleted/invalid users
              if (!userId || userId === 'Unknown User') {
                return null;
              }

              return (
                <Link
                  key={`${userId}-${index}`}
                  to={`/profile/${userId}`}
                  className="reaction-item"
                  onClick={onClose}
                >
                  <div className="reaction-user-avatar">
                    {profilePhoto ? (
                      <img src={getImageUrl(profilePhoto)} alt={username} />
                    ) : (
                      <span>{displayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="reaction-user-info">
                    <div className="reaction-user-name">{displayName}</div>
                    <div className="reaction-user-username">@{username}</div>
                  </div>
                  <div className="reaction-emoji">{reaction.emoji}</div>
                </Link>
              );
            }).filter(Boolean)
          )}
        </div>
      </div>
    </div>
  );
}

export default ReactionDetailsModal;

