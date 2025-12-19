import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import OptimizedImage from './OptimizedImage';
import { getImageUrl } from '../utils/imageUrl';
import { sanitizeContent } from '../utils/sanitize';
import '../pages/Feed.css';

/**
 * CommentThread Component
 * 
 * Renders a single comment with its replies (one level of nesting only).
 * 
 * Props:
 * - comment: Comment object with authorId populated
 * - replies: Array of reply objects (comments with parentCommentId === comment._id)
 * - currentUser: Current logged-in user object
 * - postId: ID of the post this comment belongs to
 * - showReplies: Object tracking which comments have replies visible
 * - editingCommentId: ID of comment currently being edited
 * - editCommentText: Text content of comment being edited
 * - showReactionPicker: ID of comment showing reaction picker
 * - commentRefs: Ref object for scrolling to comments
 * - getUserReactionEmoji: Function to get user's selected emoji from reactions object
 * - handleEditComment: Function to start editing a comment
 * - handleSaveEditComment: Function to save edited comment
 * - handleCancelEditComment: Function to cancel editing
 * - handleDeleteComment: Function to delete a comment
 * - handleCommentReaction: Function to add/remove reaction
 * - toggleReplies: Function to toggle reply visibility (lazy load)
 * - handleReplyToComment: Function to start replying to a comment
 * - setShowReactionPicker: Function to show/hide reaction picker
 * - setReactionDetailsModal: Function to show reaction details modal
 * - setReportModal: Function to show report modal
 */
const CommentThread = ({
  comment,
  replies = [],
  currentUser,
  postId,
  showReplies,
  editingCommentId,
  editCommentText,
  showReactionPicker,
  commentRefs,
  getUserReactionEmoji,
  handleEditComment,
  handleSaveEditComment,
  handleCancelEditComment,
  handleDeleteComment,
  handleCommentReaction,
  toggleReplies,
  handleReplyToComment,
  setShowReactionPicker,
  setReactionDetailsModal,
  setReportModal
}) => {
  // Reaction picker timeout ref
  const reactionPickerTimeoutRef = useRef(null);

  // Only render if comment has no parent (top-level comment)
  if (comment.parentCommentId !== null && comment.parentCommentId !== undefined) {
    return null;
  }

  const isEditing = editingCommentId === comment._id;
  const isOwnComment = comment.authorId?._id === currentUser?._id || comment.authorId === currentUser?._id;
  const userReactionEmoji = getUserReactionEmoji(comment.reactions);

  return (
    <div key={comment._id} className="comment-thread">
      <div
        className="comment"
        ref={(el) => commentRefs.current[comment._id] = el}
      >
        {comment.isDeleted ? (
          <div className="comment-deleted">
            <span className="deleted-icon">🗑️</span>
            <span className="deleted-text">This comment was removed</span>
          </div>
        ) : (
          <>
            <Link
              to={`/profile/${comment.authorId?.username}`}
              className="comment-avatar"
              style={{ textDecoration: 'none' }}
              aria-label={`View ${comment.authorId?.displayName || comment.authorId?.username}'s profile`}
            >
              {comment.authorId?.profilePhoto ? (
                <OptimizedImage
                  src={getImageUrl(comment.authorId.profilePhoto)}
                  alt={comment.authorId.username}
                  className="avatar-image"
                />
              ) : (
                <span>{comment.authorId?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
              )}
            </Link>
            <div className="comment-content-wrapper">
              <div className="comment-header">
                <Link
                  to={`/profile/${comment.authorId?.username}`}
                  className="comment-author"
                  style={{ textDecoration: 'none' }}
                >
                  <span className="author-name">{comment.authorId?.displayName || comment.authorId?.username}</span>
                  {comment.authorId?.isVerified && <span className="verified-badge">✓</span>}
                  {comment.authorId?.pronouns && (
                    <span className="author-pronouns">({comment.authorId.pronouns})</span>
                  )}
                </Link>
                <span className="comment-timestamp">
                  {new Date(comment.createdAt).toLocaleString()}
                  {comment.isEdited && <span className="edited-indicator"> (edited)</span>}
                </span>
              </div>

              {isEditing ? (
                <div className="comment-edit-box">
                  <textarea
                    value={editCommentText}
                    onChange={(e) => handleEditComment(comment._id, e.target.value)}
                    className="comment-edit-input"
                    autoFocus
                  />
                  <div className="comment-edit-actions">
                    <button
                      className="btn-primary"
                      onClick={() => handleSaveEditComment(comment._id)}
                    >
                      Save
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={handleCancelEditComment}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="comment-text">{sanitizeContent(comment.content)}</p>
                  {comment.gifUrl && (
                    <div className="comment-gif">
                      <img src={comment.gifUrl} alt="GIF" />
                    </div>
                  )}
                </>
              )}

              <div className="comment-actions">
                <div className="reaction-container">
                  <button
                    className={`comment-action-btn ${userReactionEmoji ? 'liked' : ''}`}
                    onClick={(e) => {
                      if (window.innerWidth <= 768) {
                        e.preventDefault();
                        setShowReactionPicker(showReactionPicker === `comment-${comment._id}` ? null : `comment-${comment._id}`);
                      } else {
                        handleCommentReaction(comment._id, userReactionEmoji || '👍');
                      }
                    }}
                    onMouseEnter={() => {
                      if (window.innerWidth > 768) {
                        if (reactionPickerTimeoutRef.current) {
                          clearTimeout(reactionPickerTimeoutRef.current);
                          reactionPickerTimeoutRef.current = null;
                        }
                        setShowReactionPicker(`comment-${comment._id}`);
                      }
                    }}
                    onMouseLeave={() => {
                      if (window.innerWidth > 768) {
                        reactionPickerTimeoutRef.current = setTimeout(() => {
                          setShowReactionPicker(null);
                        }, 500);
                      }
                    }}
                    onTouchStart={(e) => {
                      const touchTimer = setTimeout(() => {
                        setShowReactionPicker(`comment-${comment._id}`);
                      }, 500);
                      e.currentTarget.dataset.touchTimer = touchTimer;
                    }}
                    onTouchEnd={(e) => {
                      if (e.currentTarget.dataset.touchTimer) {
                        clearTimeout(parseInt(e.currentTarget.dataset.touchTimer));
                        delete e.currentTarget.dataset.touchTimer;
                      }
                    }}
                  >
                    <span>{userReactionEmoji || '👍'}</span>
                  </button>
                  {Object.values(comment.reactions || {}).flat().length > 0 && (
                    <button
                      className="reaction-count-btn"
                      onClick={() => {
                        const reactionsArray = [];
                        Object.entries(comment.reactions || {}).forEach(([emoji, userIds]) => {
                          userIds.forEach(userId => {
                            reactionsArray.push({ user: userId, emoji });
                          });
                        });
                        setReactionDetailsModal({
                          isOpen: true,
                          reactions: reactionsArray,
                          likes: []
                        });
                      }}
                    >
                      {Object.values(comment.reactions || {}).flat().length}
                    </button>
                  )}
                  {showReactionPicker === `comment-${comment._id}` && (
                    <div
                      className="reaction-picker"
                      onMouseEnter={() => {
                        if (window.innerWidth > 768) {
                          if (reactionPickerTimeoutRef.current) {
                            clearTimeout(reactionPickerTimeoutRef.current);
                            reactionPickerTimeoutRef.current = null;
                          }
                          setShowReactionPicker(`comment-${comment._id}`);
                        }
                      }}
                      onMouseLeave={() => {
                        if (window.innerWidth > 768) {
                          reactionPickerTimeoutRef.current = setTimeout(() => {
                            setShowReactionPicker(null);
                          }, 500);
                        }
                      }}
                    >
                      {['👍', '❤️', '😂', '😮', '😢', '😡', '🤗', '🎉', '🤔', '🔥', '👏', '🤯', '🤢', '👎', '🏳️‍🌈', '🏳️‍⚧️'].map(emoji => (
                        <button
                          key={emoji}
                          className="reaction-btn"
                          onClick={() => {
                            handleCommentReaction(comment._id, emoji);
                            setShowReactionPicker(null);
                          }}
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="comment-action-btn"
                  onClick={() => handleReplyToComment(postId, comment._id)}
                >
                  💬 Reply
                </button>
                {comment.replyCount > 0 && (
                  <button
                    className="comment-action-btn view-replies-btn"
                    onClick={() => toggleReplies(comment._id)}
                  >
                    {showReplies[comment._id] ? '▲' : '▼'} View {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}
                  </button>
                )}
                {isOwnComment ? (
                  <>
                    <button
                      className="comment-action-btn"
                      onClick={() => handleEditComment(comment._id, comment.content)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="comment-action-btn delete-btn"
                      onClick={() => handleDeleteComment(postId, comment._id, false)}
                    >
                      🗑️ Delete
                    </button>
                  </>
                ) : (
                  <button
                    className="comment-action-btn"
                    onClick={() => {
                      setReportModal({ isOpen: true, type: 'comment', contentId: comment._id, userId: comment.authorId?._id });
                    }}
                  >
                    🚩 Report
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Replies Section - Only render if replies are visible */}
      {showReplies[comment._id] && replies.length > 0 && (
        <div className="comment-replies">
          {replies.map((reply) => {
            const isEditingReply = editingCommentId === reply._id;
            const isOwnReply = reply.authorId?._id === currentUser?._id || reply.authorId === currentUser?._id;
            const replyReactionEmoji = getUserReactionEmoji(reply.reactions);

            return (
              <div
                key={reply._id}
                className="comment reply"
                ref={(el) => commentRefs.current[reply._id] = el}
              >
                {reply.isDeleted ? (
                  <div className="comment-deleted">
                    <span className="deleted-icon">🗑️</span>
                    <span className="deleted-text">This reply was removed</span>
                  </div>
                ) : (
                  <>
                    <Link
                      to={`/profile/${reply.authorId?.username}`}
                      className="comment-avatar"
                      style={{ textDecoration: 'none' }}
                      aria-label={`View ${reply.authorId?.displayName || reply.authorId?.username}'s profile`}
                    >
                      {reply.authorId?.profilePhoto ? (
                        <OptimizedImage
                          src={getImageUrl(reply.authorId.profilePhoto)}
                          alt={reply.authorId.username}
                          className="avatar-image"
                        />
                      ) : (
                        <span>{reply.authorId?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                      )}
                    </Link>
                    <div className="comment-content-wrapper">
                      <div className="comment-header">
                        <Link
                          to={`/profile/${reply.authorId?.username}`}
                          className="comment-author"
                          style={{ textDecoration: 'none' }}
                        >
                          <span className="author-name">{reply.authorId?.displayName || reply.authorId?.username}</span>
                          {reply.authorId?.isVerified && <span className="verified-badge">✓</span>}
                          {reply.authorId?.pronouns && (
                            <span className="author-pronouns">({reply.authorId.pronouns})</span>
                          )}
                        </Link>
                        <span className="comment-timestamp">
                          {new Date(reply.createdAt).toLocaleString()}
                          {reply.isEdited && <span className="edited-indicator"> (edited)</span>}
                        </span>
                      </div>

                      {isEditingReply ? (
                        <div className="comment-edit-box">
                          <textarea
                            value={editCommentText}
                            onChange={(e) => handleEditComment(reply._id, e.target.value)}
                            className="comment-edit-input"
                            autoFocus
                          />
                          <div className="comment-edit-actions">
                            <button
                              className="btn-primary"
                              onClick={() => handleSaveEditComment(reply._id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn-secondary"
                              onClick={handleCancelEditComment}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="comment-text">{reply.content}</p>
                          {reply.gifUrl && (
                            <div className="comment-gif">
                              <img src={reply.gifUrl} alt="GIF" />
                            </div>
                          )}
                        </>
                      )}

                      <div className="comment-actions">
                        <div className="reaction-container">
                          <button
                            className={`comment-action-btn ${replyReactionEmoji ? 'liked' : ''}`}
                            onClick={(e) => {
                              if (window.innerWidth <= 768) {
                                e.preventDefault();
                                setShowReactionPicker(showReactionPicker === `reply-${reply._id}` ? null : `reply-${reply._id}`);
                              } else {
                                handleCommentReaction(reply._id, replyReactionEmoji || '👍');
                              }
                            }}
                            onMouseEnter={() => {
                              if (window.innerWidth > 768) {
                                if (reactionPickerTimeoutRef.current) {
                                  clearTimeout(reactionPickerTimeoutRef.current);
                                  reactionPickerTimeoutRef.current = null;
                                }
                                setShowReactionPicker(`reply-${reply._id}`);
                              }
                            }}
                            onMouseLeave={() => {
                              if (window.innerWidth > 768) {
                                reactionPickerTimeoutRef.current = setTimeout(() => {
                                  setShowReactionPicker(null);
                                }, 500);
                              }
                            }}
                            onTouchStart={(e) => {
                              const touchTimer = setTimeout(() => {
                                setShowReactionPicker(`reply-${reply._id}`);
                              }, 500);
                              e.currentTarget.dataset.touchTimer = touchTimer;
                            }}
                            onTouchEnd={(e) => {
                              if (e.currentTarget.dataset.touchTimer) {
                                clearTimeout(parseInt(e.currentTarget.dataset.touchTimer));
                                delete e.currentTarget.dataset.touchTimer;
                              }
                            }}
                          >
                            <span>{replyReactionEmoji || '👍'}</span>
                          </button>
                          {Object.values(reply.reactions || {}).flat().length > 0 && (
                            <button
                              className="reaction-count-btn"
                              onClick={() => {
                                const reactionsArray = [];
                                Object.entries(reply.reactions || {}).forEach(([emoji, userIds]) => {
                                  userIds.forEach(userId => {
                                    reactionsArray.push({ user: userId, emoji });
                                  });
                                });
                                setReactionDetailsModal({
                                  isOpen: true,
                                  reactions: reactionsArray,
                                  likes: []
                                });
                              }}
                            >
                              {Object.values(reply.reactions || {}).flat().length}
                            </button>
                          )}
                          {showReactionPicker === `reply-${reply._id}` && (
                            <div
                              className="reaction-picker"
                              onMouseEnter={() => {
                                if (window.innerWidth > 768) {
                                  if (reactionPickerTimeoutRef.current) {
                                    clearTimeout(reactionPickerTimeoutRef.current);
                                    reactionPickerTimeoutRef.current = null;
                                  }
                                  setShowReactionPicker(`reply-${reply._id}`);
                                }
                              }}
                              onMouseLeave={() => {
                                if (window.innerWidth > 768) {
                                  reactionPickerTimeoutRef.current = setTimeout(() => {
                                    setShowReactionPicker(null);
                                  }, 500);
                                }
                              }}
                            >
                              {['👍', '❤️', '😂', '😮', '😢', '😡', '🤗', '🎉', '🤔', '🔥', '👏', '🤯', '🤢', '👎', '🏳️‍🌈', '🏳️‍⚧️'].map(emoji => (
                                <button
                                  key={emoji}
                                  className="reaction-btn"
                                  onClick={() => {
                                    handleCommentReaction(reply._id, emoji);
                                    setShowReactionPicker(null);
                                  }}
                                  title={emoji}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {isOwnReply ? (
                          <>
                            <button
                              className="comment-action-btn"
                              onClick={() => handleEditComment(reply._id, reply.content)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="comment-action-btn delete-btn"
                              onClick={() => handleDeleteComment(postId, reply._id, true)}
                            >
                              🗑️ Delete
                            </button>
                          </>
                        ) : (
                          <button
                            className="comment-action-btn"
                            onClick={() => {
                              setReportModal({ isOpen: true, type: 'comment', contentId: reply._id, userId: reply.authorId?._id });
                            }}
                          >
                            🚩 Report
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommentThread;

