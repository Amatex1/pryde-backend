import { useState, useEffect, useRef } from 'react';
import { sendMessage, onNewMessage, onMessageSent } from '../utils/socket';
import api from '../utils/api';
import './MiniChat.css';

function MiniChat({ friendId, friendName, friendPhoto, onClose, onMinimize, isMinimized }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const currentUserId = localStorage.getItem('userId');

  // Helper function to get image URL
  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${import.meta.env.VITE_API_URL || 'https://pryde-social.onrender.com'}${path}`;
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
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

    onNewMessage(handleNewMessage);
    onMessageSent(handleMessageSent);
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
          </div>
          <span className="header-name">{friendName}</span>
        </div>
        <div className="mini-chat-controls">
          <button onClick={onMinimize} title="Minimize">−</button>
          <button onClick={onClose} title="Close">×</button>
        </div>
      </div>

      <div className="mini-chat-messages">
        {isLoading ? (
          <div className="loading">Loading messages...</div>
        ) : messages.length > 0 ? (
          messages.map((msg, index) => (
            <div 
              key={msg._id || index} 
              className={`message ${msg.sender._id === currentUserId ? 'sent' : 'received'}`}
            >
              <div className="message-content">{msg.content}</div>
            </div>
          ))
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

