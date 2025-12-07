/**
 * PHASE 2: Global Feed - Chronological feed of all public posts
 * Full-featured with reactions, comments, and real-time updates
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ReactionDetailsModal from '../components/ReactionDetailsModal';
import FormattedText from '../components/FormattedText';
import OptimizedImage from '../components/OptimizedImage';
import PostSkeleton from '../components/PostSkeleton';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import { getSocket } from '../utils/socket';
import { convertEmojiShortcuts } from '../utils/textFormatting';
import './GlobalFeed.css';
import './Feed.css';

function GlobalFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [showCommentBox, setShowCommentBox] = useState({});
  const [commentText, setCommentText] = useState({});
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [reactionDetailsModal, setReactionDetailsModal] = useState({ isOpen: false, reactions: [], likes: [] });
  const [showReplies, setShowReplies] = useState({});
  const currentUser = getCurrentUser();
  const listenersSetUpRef = useRef(false);

  useEffect(() => {
    fetchGlobalFeed();
  }, []);

  // Set up real-time socket listeners
  useEffect(() => {
    if (listenersSetUpRef.current) return;

    const cleanupFunctions = [];

    const setupListeners = () => {
      const socket = getSocket();
      if (socket) {
        // Listen for real-time post reactions
        const handlePostReaction = (data) => {
          console.log('💜 Real-time post reaction received:', data);
          setPosts((prevPosts) =>
            prevPosts.map(p => p._id === data.postId ? data.post : p)
          );
        };
        socket.on('post_reaction_added', handlePostReaction);
        cleanupFunctions.push(() => socket.off('post_reaction_added', handlePostReaction));

        // Listen for real-time comment reactions
        const handleCommentReaction = (data) => {
          console.log('💜 Real-time comment reaction received:', data);
          setPosts((prevPosts) =>
            prevPosts.map(p => p._id === data.postId ? data.post : p)
          );
        };
        socket.on('comment_reaction_added', handleCommentReaction);
        cleanupFunctions.push(() => socket.off('comment_reaction_added', handleCommentReaction));

        // Listen for real-time comments
        const handleCommentAdded = (data) => {
          console.log('💬 Real-time comment received:', data);
          setPosts((prevPosts) =>
            prevPosts.map(p => p._id === data.postId ? data.post : p)
          );
        };
        socket.on('comment_added', handleCommentAdded);
        cleanupFunctions.push(() => socket.off('comment_added', handleCommentAdded));
      }
    };

    listenersSetUpRef.current = true;

    const checkSocket = () => {
      const socket = getSocket();
      if (!socket) {
        setTimeout(checkSocket, 100);
        return;
      }
      if (socket.connected) {
        setupListeners();
      } else {
        socket.once('connect', setupListeners);
      }
    };

    checkSocket();

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup?.());
    };
  }, []);

  const fetchGlobalFeed = async (before = null) => {
    try {
      setLoading(true);
      const params = { limit: 20 };
      if (before) {
        params.before = before;
      }

      const response = await api.get('/feed/global', { params });
      const newPosts = response.data;

      if (before) {
        setPosts(prev => [...prev, ...newPosts]);
      } else {
        setPosts(newPosts);
      }

      setHasMore(newPosts.length === 20);
    } catch (error) {
      console.error('Failed to fetch global feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (posts.length > 0 && hasMore && !loading) {
      const lastPost = posts[posts.length - 1];
      fetchGlobalFeed(lastPost.createdAt);
    }
  };

  const handlePostReaction = async (postId, emoji) => {
    try {
      const response = await api.post(`/posts/${postId}/react`, { emoji });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setShowReactionPicker(null);
    } catch (error) {
      console.error('Failed to react to post:', error);
    }
  };

  const handleCommentReaction = async (postId, commentId, emoji) => {
    try {
      const response = await api.post(`/posts/${postId}/comment/${commentId}/react`, { emoji });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setShowReactionPicker(null);
    } catch (error) {
      console.error('Failed to react to comment:', error);
    }
  };

  const toggleCommentBox = (postId) => {
    setShowCommentBox(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  const handleCommentSubmit = async (postId, e) => {
    e.preventDefault();
    const content = commentText[postId];
    if (!content || !content.trim()) return;

    try {
      const contentWithEmojis = convertEmojiShortcuts(content);
      const response = await api.post(`/posts/${postId}/comment`, { content: contentWithEmojis });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setCommentText(prev => ({ ...prev, [postId]: '' }));
    } catch (error) {
      console.error('Failed to comment:', error);
    }
  };

  const handleCommentChange = (postId, value) => {
    setCommentText(prev => ({ ...prev, [postId]: value }));
  };

  const handleReplyToComment = (postId, commentId) => {
    setReplyingToComment({ postId, commentId });
    setReplyText('');
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !replyingToComment) return;

    try {
      const { postId, commentId } = replyingToComment;
      const contentWithEmojis = convertEmojiShortcuts(replyText);
      const response = await api.post(`/posts/${postId}/comment/${commentId}/reply`, { content: contentWithEmojis });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setReplyingToComment(null);
      setReplyText('');
    } catch (error) {
      console.error('Failed to reply to comment:', error);
    }
  };

  const handleCancelReply = () => {
    setReplyingToComment(null);
    setReplyText('');
  };

  const toggleReplies = (commentId) => {
    setShowReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  if (loading && posts.length === 0) {
    return (
      <>
        <Navbar />
        <div className="global-feed-container">
          <div className="feed-header">
            <h1>🌍 Everyone</h1>
            <p className="feed-subtitle">Explore posts from the entire community</p>
          </div>
          <div className="posts-list">
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="global-feed-container">
        <div className="feed-header">
          <h1>🌍 Everyone</h1>
          <p className="feed-subtitle">Explore posts from the entire community</p>
        </div>

        <div className="posts-list">
          {posts.map(post => {
            const isLiked = post.hasLiked || false;

            return (
              <div key={post._id} className="post-card glossy">
                {/* Post Header */}
                <div className="post-header">
                  <Link to={`/profile/${post.author?.username}`} className="post-author">
                    <div className="author-avatar">
                      {post.author?.profilePhoto ? (
                        <OptimizedImage
                          src={getImageUrl(post.author.profilePhoto)}
                          alt={post.author.username}
                          className="avatar-image"
                        />
                      ) : (
                        <span>{post.author?.displayName?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="author-info">
                      <span className="author-name">
                        {post.author?.displayName}
                        {post.author?.isVerified && <span className="verified-badge">✓</span>}
                      </span>
                      <span className="post-time">
                        {(() => {
                          const postDate = new Date(post.createdAt);
                          const now = new Date();
                          const diffMs = now - postDate;
                          const diffMins = Math.floor(diffMs / 60000);
                          const diffHours = Math.floor(diffMs / 3600000);
                          const diffDays = Math.floor(diffMs / 86400000);

                          if (diffMins < 1) return 'Just now';
                          if (diffMins < 60) return `${diffMins}m`;
                          if (diffHours < 24) return `${diffHours}h`;
                          if (diffDays < 7) return `${diffDays}d`;
                          return postDate.toLocaleDateString();
                        })()}
                      </span>
                    </div>
                  </Link>
                </div>

                {/* Post Content */}
                <div className="post-content">
                  <FormattedText text={post.content} />
                  {post.media && post.media.length > 0 && (
                    <div className="post-media">
                      {post.media.map((item, index) => (
                        item.type === 'image' ? (
                          <OptimizedImage
                            key={index}
                            src={getImageUrl(item.url)}
                            alt="Post media"
                          />
                        ) : (
                          <video key={index} src={getImageUrl(item.url)} controls />
                        )
                      ))}
                    </div>
                  )}
                </div>

                {/* Post Actions - Reactions */}
                <div className="post-actions">
                  <div className="reaction-container">
                    <button
                      className={`action-btn ${isLiked || post.reactions?.some(r => r.user?._id === currentUser?.id || r.user === currentUser?.id) ? 'liked' : ''}`}
                      onClick={() => handlePostReaction(post._id, '❤️')}
                      onMouseEnter={() => {
                        if (window.innerWidth > 768) {
                          setShowReactionPicker(`post-${post._id}`);
                        }
                      }}
                      onTouchStart={(e) => {
                        const touchTimer = setTimeout(() => {
                          setShowReactionPicker(`post-${post._id}`);
                        }, 500);
                        e.currentTarget.dataset.touchTimer = touchTimer;
                      }}
                      onTouchEnd={(e) => {
                        if (e.currentTarget.dataset.touchTimer) {
                          clearTimeout(e.currentTarget.dataset.touchTimer);
                        }
                      }}
                      onMouseLeave={() => {
                        if (window.innerWidth > 768) {
                          setTimeout(() => {
                            if (showReactionPicker === `post-${post._id}`) {
                              setShowReactionPicker(null);
                            }
                          }, 300);
                        }
                      }}
                    >
                      {post.reactions?.find(r => r.user?._id === currentUser?.id || r.user === currentUser?.id)?.emoji || '❤️'} React
                    </button>

                    {post.reactions?.length > 0 && (
                      <button
                        className="reaction-count-btn"
                        onClick={() => setReactionDetailsModal({
                          isOpen: true,
                          reactions: post.reactions || [],
                          likes: []
                        })}
                      >
                        ({post.reactions.length})
                      </button>
                    )}

                    {showReactionPicker === `post-${post._id}` && (
                      <div
                        className="reaction-picker"
                        onMouseEnter={() => {
                          if (window.innerWidth > 768) {
                            setShowReactionPicker(`post-${post._id}`);
                          }
                        }}
                        onMouseLeave={() => {
                          if (window.innerWidth > 768) {
                            setShowReactionPicker(null);
                          }
                        }}
                      >
                        {['❤️', '😂', '😮', '😢', '😡', '👍', '🏳️‍🌈', '🏳️‍⚧️'].map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => handlePostReaction(post._id, emoji)}
                            className="reaction-emoji-btn"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    className="action-btn"
                    onClick={() => toggleCommentBox(post._id)}
                  >
                    💬 Comment {post.comments?.length > 0 && `(${post.comments.length})`}
                  </button>
                </div>

                {/* Tags Display */}
                {post.tags && post.tags.length > 0 && (
                  <div className="post-tags">
                    {post.tags.map(tag => (
                      <Link
                        key={tag._id}
                        to={`/tags/${tag.slug}`}
                        className="post-tag"
                      >
                        {tag.icon} {tag.label}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Comments Section */}
                {post.comments && post.comments.length > 0 && (
                  <div className="post-comments">
                    {post.comments.filter(comment => !comment.parentComment).slice(-3).map((comment) => {
                      const replies = post.comments.filter(c => c.parentComment === comment._id);

                      return (
                        <div key={comment._id} className="comment">
                          <div className="comment-header">
                            <Link to={`/profile/${comment.user?.username}`} className="comment-author">
                              <div className="comment-avatar">
                                {comment.user?.profilePhoto ? (
                                  <OptimizedImage
                                    src={getImageUrl(comment.user.profilePhoto)}
                                    alt={comment.user.username}
                                    className="avatar-image"
                                  />
                                ) : (
                                  <span>{comment.user?.displayName?.charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="comment-info">
                                <span className="comment-author-name">
                                  {comment.user?.displayName}
                                  {comment.user?.isVerified && <span className="verified-badge">✓</span>}
                                </span>
                                <span className="comment-time">
                                  {(() => {
                                    const commentDate = new Date(comment.createdAt);
                                    const now = new Date();
                                    const diffMs = now - commentDate;
                                    const diffMins = Math.floor(diffMs / 60000);
                                    const diffHours = Math.floor(diffMs / 3600000);
                                    const diffDays = Math.floor(diffMs / 86400000);

                                    if (diffMins < 1) return 'Just now';
                                    if (diffMins < 60) return `${diffMins}m`;
                                    if (diffHours < 24) return `${diffHours}h`;
                                    if (diffDays < 7) return `${diffDays}d`;
                                    return commentDate.toLocaleDateString();
                                  })()}
                                </span>
                                <div className="reaction-container">
                                  <button
                                    className={`comment-action-btn ${comment.reactions?.some(r => r.user?._id === currentUser?.id || r.user === currentUser?.id) ? 'liked' : ''}`}
                                    onClick={(e) => {
                                      if (window.innerWidth <= 768) {
                                        e.preventDefault();
                                        setShowReactionPicker(showReactionPicker === `comment-${comment._id}` ? null : `comment-${comment._id}`);
                                      } else {
                                        const userReaction = comment.reactions?.find(r => r.user?._id === currentUser?.id || r.user === currentUser?.id);
                                        handleCommentReaction(post._id, comment._id, userReaction?.emoji || '👍');
                                      }
                                    }}
                                    onMouseEnter={() => {
                                      if (window.innerWidth > 768) {
                                        setShowReactionPicker(`comment-${comment._id}`);
                                      }
                                    }}
                                    onMouseLeave={() => {
                                      if (window.innerWidth > 768) {
                                        setTimeout(() => {
                                          if (showReactionPicker === `comment-${comment._id}`) {
                                            setShowReactionPicker(null);
                                          }
                                        }, 300);
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
                                    {comment.reactions?.find(r => r.user?._id === currentUser?.id || r.user === currentUser?.id)?.emoji || '👍'}
                                  </button>
                                  {comment.reactions?.length > 0 && (
                                    <button
                                      className="reaction-count-btn"
                                      onClick={() => setReactionDetailsModal({
                                        isOpen: true,
                                        reactions: comment.reactions || [],
                                        likes: []
                                      })}
                                    >
                                      {comment.reactions.length}
                                    </button>
                                  )}
                                  {showReactionPicker === `comment-${comment._id}` && (
                                    <div
                                      className="reaction-picker"
                                      onMouseEnter={() => {
                                        if (window.innerWidth > 768) {
                                          setShowReactionPicker(`comment-${comment._id}`);
                                        }
                                      }}
                                      onMouseLeave={() => {
                                        if (window.innerWidth > 768) {
                                          setShowReactionPicker(null);
                                        }
                                      }}
                                    >
                                      {['👍', '❤️', '😂', '😮', '😢', '😡', '🤗', '🎉', '🤔', '🔥', '👏', '🤯', '🤢', '👎'].map(emoji => (
                                        <button
                                          key={emoji}
                                          onClick={() => {
                                            handleCommentReaction(post._id, comment._id, emoji);
                                            setShowReactionPicker(null);
                                          }}
                                          className="reaction-emoji-btn"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  className="comment-action-btn"
                                  onClick={() => handleReplyToComment(post._id, comment._id)}
                                >
                                  Reply
                                </button>
                              </div>
                            </Link>
                          </div>
                          <div className="comment-content">
                            <FormattedText text={comment.content} />
                          </div>

                          {/* Replies */}
                          {replies.length > 0 && (
                            <div className="comment-replies">
                              <button
                                className="toggle-replies-btn"
                                onClick={() => toggleReplies(comment._id)}
                              >
                                {showReplies[comment._id] ? '▼' : '▶'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                              </button>

                              {showReplies[comment._id] && replies.map((reply) => (
                                <div key={reply._id} className="comment reply">
                                  <div className="comment-header">
                                    <Link to={`/profile/${reply.user?.username}`} className="comment-author">
                                      <div className="comment-avatar">
                                        {reply.user?.profilePhoto ? (
                                          <OptimizedImage
                                            src={getImageUrl(reply.user.profilePhoto)}
                                            alt={reply.user.username}
                                            className="avatar-image"
                                          />
                                        ) : (
                                          <span>{reply.user?.displayName?.charAt(0).toUpperCase()}</span>
                                        )}
                                      </div>
                                      <div className="comment-info">
                                        <span className="comment-author-name">
                                          {reply.user?.displayName}
                                          {reply.user?.isVerified && <span className="verified-badge">✓</span>}
                                        </span>
                                        <span className="comment-time">
                                          {(() => {
                                            const replyDate = new Date(reply.createdAt);
                                            const now = new Date();
                                            const diffMs = now - replyDate;
                                            const diffMins = Math.floor(diffMs / 60000);
                                            const diffHours = Math.floor(diffMs / 3600000);
                                            const diffDays = Math.floor(diffMs / 86400000);

                                            if (diffMins < 1) return 'Just now';
                                            if (diffMins < 60) return `${diffMins}m`;
                                            if (diffHours < 24) return `${diffHours}h`;
                                            if (diffDays < 7) return `${diffDays}d`;
                                            return replyDate.toLocaleDateString();
                                          })()}
                                        </span>
                                      </div>
                                    </Link>
                                  </div>
                                  <div className="comment-content">
                                    <FormattedText text={reply.content} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reply Input */}
                          {replyingToComment?.postId === post._id && replyingToComment?.commentId === comment._id && (
                            <form onSubmit={handleSubmitReply} className="reply-input-box">
                              <input
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a reply..."
                                className="reply-input glossy"
                                autoFocus
                              />
                              <button type="submit" className="reply-submit-btn" disabled={!replyText.trim()}>
                                ➤
                              </button>
                              <button type="button" onClick={handleCancelReply} className="reply-cancel-btn">
                                ✕
                              </button>
                            </form>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Comment Input Box */}
                {showCommentBox[post._id] && (
                  <form onSubmit={(e) => handleCommentSubmit(post._id, e)} className="comment-input-box">
                    <div className="comment-input-wrapper">
                      <div className="comment-user-avatar">
                        {currentUser?.profilePhoto ? (
                          <OptimizedImage
                            src={getImageUrl(currentUser.profilePhoto)}
                            alt="You"
                            className="avatar-image"
                          />
                        ) : (
                          <span>{currentUser?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={commentText[post._id] || ''}
                        onChange={(e) => handleCommentChange(post._id, e.target.value)}
                        placeholder="Write a comment..."
                        className="comment-input glossy"
                      />
                      <button
                        type="submit"
                        className="comment-submit-btn"
                        disabled={!commentText[post._id]?.trim()}
                      >
                        ➤
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        {hasMore && (
          <button onClick={loadMore} className="btn-load-more" disabled={loading}>
            {loading ? 'Loading...' : 'Load More'}
          </button>
        )}
      </div>

      {reactionDetailsModal.isOpen && (
        <ReactionDetailsModal
          reactions={reactionDetailsModal.reactions}
          likes={reactionDetailsModal.likes}
          onClose={() => setReactionDetailsModal({ isOpen: false, reactions: [], likes: [] })}
        />
      )}
    </>
  );
}

export default GlobalFeed;

