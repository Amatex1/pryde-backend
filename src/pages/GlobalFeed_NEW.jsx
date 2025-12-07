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
          <div className="loading">Loading...</div>
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

