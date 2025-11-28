import { useState, useEffect, useRef } from 'react';
import { sendMessage, onNewMessage, onMessageSent, onUserOnline, onUserOffline, onOnlineUsers } from '../utils/socket';
import api from '../utils/api';
import './MiniChat.css';

function MiniChat({ friendId, friendName, friendPhoto, onClose, onMinimize, isMinimized }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const messagesEndRef = useRef(null);
  const currentUserId = localStorage.getItem('userId');

  // Helper function to get image URL
  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${import.meta.env.VITE_API_URL || 'https://pryde-social.onrender.com'}${path}`;
  };

  // Helper function to format date headers
  const formatDateHeader = (date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time to midnight for comparison
    const messageDateMidnight = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayMidnight = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (messageDateMidnight.getTime() === todayMidnight.getTime()) {
      return 'Today';
    } else if (messageDateMidnight.getTime() === yesterdayMidnight.getTime()) {
      return 'Yesterday';
    } else {
      // Format as "Monday, January 15, 2024"
      return messageDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  // Helper function to check if we need a date header
  const shouldShowDateHeader = (currentMsg, previousMsg) => {
    if (!previousMsg) return true; // Always show header for first message

    const currentDate = new Date(currentMsg.createdAt);
    const previousDate = new Date(previousMsg.createdAt);

    // Compare dates (ignoring time)
    return currentDate.toDateString() !== previousDate.toDateString();
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Fetch current user data
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/auth/me');
        setCurrentUserData(response.data);
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };

    // Fetch friend data for online status
    const fetchFriendData = async () => {
      try {
        const response = await api.get(`/users/${friendId}`);
        setLastSeen(response.data.lastSeen);
      } catch (error) {
        console.error('Error fetching friend data:', error);
      }
    };

    // Fetch messages
    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        const response = await api.get(`/messages/${friendId}`);
        setMessages(response.data);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentUser();
    fetchFriendData();
    fetchMessages();

    // Socket listeners
    const handleNewMessage = (msg) => {
      if (msg.sender._id === friendId || msg.recipient._id === friendId) {
        setMessages(prev => [...prev, msg]);
      }
    };

    const handleMessageSent = (msg) => {
      if (msg.recipient._id === friendId) {
        setMessages(prev => [...prev, msg]);
      }
    };

    const handleUserOnline = (userId) => {
      if (userId === friendId) {
        setIsOnline(true);
      }
    };

    const handleUserOffline = (userId) => {
      if (userId === friendId) {
        setIsOnline(false);
      }
    };

    const handleOnlineUsers = (users) => {
      setIsOnline(users.includes(friendId));
    };

    onNewMessage(handleNewMessage);
    onMessageSent(handleMessageSent);
    onUserOnline(handleUserOnline);
    onUserOffline(handleUserOffline);
    onOnlineUsers(handleOnlineUsers);
  }, [friendId]);

  const handleSend = () => {
    if (!inputMessage.trim()) return;

    sendMessage({
      recipientId: friendId,
      content: inputMessage.trim()
    });

    setInputMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isMinimized) {
    return (
      <div className="mini-chat-minimized glossy" onClick={onMinimize}>
        <div className="minimized-header">
          <div className="minimized-avatar">
            {friendPhoto ? (
              <img src={getImageUrl(friendPhoto)} alt={friendName} />
            ) : (
              <div className="avatar-placeholder">
                {friendName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="minimized-name">{friendName}</span>
        </div>
        <button className="btn-close-mini" onClick={(e) => { e.stopPropagation(); onClose(); }}>×</button>
      </div>
    );
  }

  return (
    <div className="mini-chat-box glossy">
      <div className="mini-chat-header">
        <div className="header-info">
          <div className="header-avatar">
            {friendPhoto ? (
              <img src={getImageUrl(friendPhoto)} alt={friendName} />
            ) : (
              <div className="avatar-placeholder">
                {friendName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className={`status-dot ${isOnline ? 'online' : 'offline'}`}></div>
          </div>
          <div className="header-text">
            <span className="header-name">{friendName}</span>
            <span className="header-status">
              {isOnline ? 'Online' : lastSeen ? `Last seen ${new Date(lastSeen).toLocaleString()}` : 'Offline'}
            </span>
          </div>
        </div>
        <div className="mini-chat-controls">
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMinimize(); }} title="Minimize">−</button>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} title="Close">×</button>
        </div>
      </div>

      <div className="mini-chat-messages">
        {isLoading ? (
          <div className="loading">Loading messages...</div>
        ) : messages.length > 0 ? (
          messages.map((msg, index) => {
            const isSent = msg.sender?._id === currentUserId || msg.sender === currentUserId;
            const previousMsg = index > 0 ? messages[index - 1] : null;
            const showDateHeader = shouldShowDateHeader(msg, previousMsg);

            return (
              <div key={msg._id || index}>
                {/* Date Header */}
                {showDateHeader && (
                  <div className="message-date-header">
                    <span>{formatDateHeader(msg.createdAt)}</span>
                  </div>
                )}

                {/* Message */}
                <div className={`message ${isSent ? 'sent' : 'received'}`}>
                  {!isSent && (
                    <div className="message-avatar">
                      {friendPhoto ? (
                        <img src={getImageUrl(friendPhoto)} alt={friendName} />
                      ) : (
                        <div className="avatar-placeholder-small">
                          {friendName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="message-bubble">
                    <div className="message-content">{msg.content}</div>
                    <div className="message-time">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {isSent && (
                    <div className="message-avatar">
                      {currentUserData?.profilePhoto ? (
                        <img src={getImageUrl(currentUserData.profilePhoto)} alt="You" />
                      ) : (
                        <div className="avatar-placeholder-small">
                          {currentUserData?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="no-messages">No messages yet. Say hi! 👋</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="mini-chat-input">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
        />
        <button onClick={handleSend} disabled={!inputMessage.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

export default MiniChat;

