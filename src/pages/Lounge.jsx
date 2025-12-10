import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import GifPicker from '../components/GifPicker';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
import { getSocket } from '../utils/socket';
import './Lounge.css';

function Lounge() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [contentWarning, setContentWarning] = useState('');
  const [showCWInput, setShowCWInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGif, setSelectedGif] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const socketRef = useRef(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Check if user is near bottom of messages
  const isNearBottom = () => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const response = await api.get('/global-chat/messages?limit=50');
        setMessages(response.data.messages || []);
        setHasMore(response.data.hasMore || false);

        // Scroll to bottom after loading
        setTimeout(scrollToBottom, 100);
      } catch (error) {
        console.error('Error fetching messages:', error);
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, []);

  // Get current user
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    setCurrentUser(user);
  }, []);

  // Socket.IO setup
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (socket) {
      // Join global chat room
      socket.emit('global_chat:join');

      // Listen for new messages
      socket.on('global_message:new', (message) => {
        setMessages(prev => [...prev, message]);
        
        // Auto-scroll if user is near bottom
        if (isNearBottom()) {
          setTimeout(scrollToBottom, 100);
        }
      });

      // Listen for deleted messages
      socket.on('global_message:deleted', ({ messageId }) => {
        setMessages(prev => prev.map(msg => 
          msg._id === messageId 
            ? { ...msg, isDeleted: true }
            : msg
        ));
      });

      // Listen for online count updates
      socket.on('global_chat:online_count', ({ count }) => {
        setOnlineCount(count);
      });

      // Handle errors
      socket.on('error', (data) => {
        setError(data.message);
        setTimeout(() => setError(''), 5000);
      });
    }

    return () => {
      if (socket) {
        socket.off('global_message:new');
        socket.off('global_message:deleted');
        socket.off('global_chat:online_count');
        socket.off('error');
      }
    };
  }, []);

  // Load more messages (pagination)
  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;

    try {
      setLoadingMore(true);
      const oldestMessage = messages[0];
      const response = await api.get(`/global-chat/messages?before=${oldestMessage.createdAt}&limit=50`);

      const newMessages = response.data.messages || [];
      setMessages(prev => [...newMessages, ...prev]);
      setHasMore(response.data.hasMore || false);
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Handle scroll for pagination
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop } = messagesContainerRef.current;
    
    // Load more when scrolled to top
    if (scrollTop === 0 && hasMore && !loadingMore) {
      loadMoreMessages();
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() && !selectedGif) return;

    if (newMessage.length > 2000) {
      setError('Message is too long (max 2000 characters)');
      setTimeout(() => setError(''), 5000);
      return;
    }

    try {
      setSending(true);
      setError('');

      // Send via Socket.IO for real-time delivery
      if (socketRef.current) {
        socketRef.current.emit('global_message:send', {
          text: newMessage.trim() || '',
          gifUrl: selectedGif || null,
          contentWarning: contentWarning.trim() || null
        });
      }

      // Clear input
      setNewMessage('');
      setSelectedGif(null);
      setContentWarning('');
      setShowCWInput(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSending(false);
    }
  };

  // Delete message (admin only)
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;

    try {
      await api.delete(`/global-chat/messages/${messageId}`);
      // Message will be updated via Socket.IO event
    } catch (error) {
      console.error('Error deleting message:', error);
      setError('Failed to delete message');
      setTimeout(() => setError(''), 5000);
    }
  };

  // Navigate to DM with user
  const handleMessageUser = (userId) => {
    if (userId === currentUser?._id) return; // Don't DM yourself
    navigate(`/messages?user=${userId}`);
  };

  // Format timestamp
  const formatTime = (date) => {
    const messageDate = new Date(date);
    const now = new Date();
    const diffMs = now - messageDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Check if user is admin/mod
  const isAdmin = currentUser?.role && ['moderator', 'admin', 'super_admin'].includes(currentUser.role);

  return (
    <div className="lounge-page">
      <Navbar />

      <div className="lounge-container">
        {/* Header */}
        <div className="lounge-header">
          <div className="lounge-title-section">
            <h1 className="lounge-title">✨ Lounge</h1>
            <p className="lounge-subtitle">
              A calm, site-wide chat room for all members. Say hi, share your day, or just sit quietly with us.
            </p>
          </div>

          {onlineCount > 0 && (
            <div className="lounge-online-count">
              <span className="online-indicator"></span>
              {onlineCount} {onlineCount === 1 ? 'member' : 'members'} online
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="lounge-error">
            {error}
          </div>
        )}

        {/* Messages */}
        <div
          className="lounge-messages"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {loading ? (
            <div className="lounge-loading">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="lounge-empty">
              <p>The Lounge is quiet right now. Be the first to say hi ✨</p>
            </div>
          ) : (
            <>
              {loadingMore && (
                <div className="lounge-loading-more">Loading more...</div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`lounge-message ${msg.isDeleted ? 'deleted' : ''} ${msg.sender?.id === currentUser?._id ? 'own-message' : ''}`}
                >
                  {msg.isDeleted ? (
                    <div className="lounge-message-deleted">
                      <span className="deleted-icon">🗑️</span>
                      Message removed by moderation
                    </div>
                  ) : (
                    <>
                      <img
                        src={getImageUrl(msg.sender?.avatar) || '/default-avatar.png'}
                        alt={msg.sender?.displayName}
                        className="lounge-message-avatar"
                        onClick={() => navigate(`/profile/${msg.sender?.username}`)}
                      />

                      <div className="lounge-message-content">
                        <div className="lounge-message-header">
                          <span
                            className="lounge-message-sender"
                            onClick={() => navigate(`/profile/${msg.sender?.username}`)}
                          >
                            {msg.sender?.displayName || msg.sender?.username}
                          </span>
                          <span className="lounge-message-time">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>

                        {msg.contentWarning && (
                          <div className="lounge-message-cw">
                            CW: {msg.contentWarning}
                          </div>
                        )}

                        {msg.text && (
                          <div className="lounge-message-text">
                            {msg.text}
                          </div>
                        )}

                        {msg.gifUrl && (
                          <div className="lounge-message-gif">
                            <img src={msg.gifUrl} alt="GIF" />
                          </div>
                        )}

                        <div className="lounge-message-actions">
                          {msg.sender?.id !== currentUser?._id && (
                            <button
                              className="lounge-action-btn"
                              onClick={() => handleMessageUser(msg.sender?.id)}
                              title="Send private message"
                            >
                              💬 DM
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              className="lounge-action-btn lounge-action-delete"
                              onClick={() => handleDeleteMessage(msg._id)}
                              title="Delete message"
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <form className="lounge-input-container" onSubmit={handleSendMessage}>
          {showCWInput && (
            <div className="lounge-cw-input">
              <input
                type="text"
                placeholder="Content warning (optional)"
                value={contentWarning}
                onChange={(e) => setContentWarning(e.target.value)}
                maxLength={50}
                className="lounge-cw-field"
              />
              <button
                type="button"
                className="lounge-cw-close"
                onClick={() => {
                  setShowCWInput(false);
                  setContentWarning('');
                }}
              >
                ✕
              </button>
            </div>
          )}

          {selectedGif && (
            <div className="lounge-gif-preview">
              <img src={selectedGif} alt="Selected GIF" />
              <button
                type="button"
                className="lounge-gif-remove"
                onClick={() => setSelectedGif(null)}
              >
                ✕
              </button>
            </div>
          )}

          <div className="lounge-input-row">
            <button
              type="button"
              className="lounge-cw-btn"
              onClick={() => setShowCWInput(!showCWInput)}
              title="Add content warning"
            >
              CW
            </button>

            <button
              type="button"
              className="lounge-gif-btn"
              onClick={() => setShowGifPicker(!showGifPicker)}
              title="Add GIF"
            >
              GIF
            </button>

            <input
              type="text"
              placeholder={selectedGif ? "Add a caption (optional)..." : "Type a message..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              maxLength={2000}
              className="lounge-input"
              disabled={sending}
            />

            <button
              type="submit"
              className="lounge-send-btn"
              disabled={(!newMessage.trim() && !selectedGif) || sending}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>

          {showGifPicker && (
            <GifPicker
              onGifSelect={(gifUrl) => {
                setSelectedGif(gifUrl);
                setShowGifPicker(false);
              }}
              onClose={() => setShowGifPicker(false)}
            />
          )}

          {newMessage.length > 1800 && (
            <div className="lounge-char-count">
              {newMessage.length} / 2000 characters
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default Lounge;

