import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { 
  onNewMessage, 
  onMessageSent, 
  sendMessage as socketSendMessage,
  emitTyping,
  onUserTyping 
} from '../utils/socket';
import './Messages.css';

function Messages() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/auth/me');
        setCurrentUser(response.data);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await api.get('/messages');
        setConversations(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching conversations:', error);
        setLoading(false);
      }
    };
    fetchConversations();
  }, []);

  // Fetch messages for selected chat
  useEffect(() => {
    if (selectedChat) {
      const fetchMessages = async () => {
        try {
          const response = await api.get(`/messages/${selectedChat}`);
          setMessages(response.data);
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      };
      fetchMessages();
    }
  }, [selectedChat]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket.IO listeners
  useEffect(() => {
    // Listen for new messages
    onNewMessage((newMessage) => {
      if (selectedChat === newMessage.sender._id) {
        setMessages((prev) => [...prev, newMessage]);
      }
      // Update conversations list
      setConversations((prev) => {
        const updated = prev.filter(c => c._id !== newMessage.sender._id);
        return [{ _id: newMessage.sender._id, lastMessage: newMessage, ...newMessage.sender }, ...updated];
      });
    });

    // Listen for sent message confirmation
    onMessageSent((sentMessage) => {
      setMessages((prev) => [...prev, sentMessage]);
    });

    // Listen for typing indicator
    onUserTyping((data) => {
      if (data.userId === selectedChat) {
        setIsTyping(data.isTyping);
      }
    });
  }, [selectedChat]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedChat) return;

    // Send via Socket.IO for real-time delivery
    socketSendMessage({
      recipientId: selectedChat,
      content: message
    });
    setMessage('');

    // Clear typing indicator
    if (currentUser) {
      emitTyping(selectedChat, currentUser._id);
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);

    if (!selectedChat || !currentUser) return;

    // Emit typing indicator
    emitTyping(selectedChat, currentUser._id);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      emitTyping(selectedChat, currentUser._id);
    }, 1000);
  };

  return (
    <div className="page-container">
      <Navbar />
      
      <div className="messages-container">
        <div className="messages-layout glossy fade-in">
          <div className="conversations-sidebar">
            <div className="sidebar-header">
              <h2 className="sidebar-title">💬 Messages</h2>
              <button className="btn-new-chat">+</button>
            </div>

            <div className="conversations-list">
              {loading ? (
                <div className="loading-state">Loading conversations...</div>
              ) : conversations.length === 0 ? (
                <div className="empty-state">No conversations yet</div>
              ) : (
                conversations.map((conv) => {
                  const otherUser = conv.lastMessage?.sender?._id === currentUser?._id 
                    ? conv.lastMessage?.recipient 
                    : conv.lastMessage?.sender;
                  
                  return (
                    <div
                      key={conv._id}
                      className={`conversation-item ${selectedChat === conv._id ? 'active' : ''}`}
                      onClick={() => setSelectedChat(conv._id)}
                    >
                      <div className="conv-avatar">
                        {otherUser?.profilePhoto ? (
                          <img src={otherUser.profilePhoto} alt={otherUser.username} />
                        ) : (
                          <span>{otherUser?.username?.charAt(0).toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <div className="conv-info">
                        <div className="conv-header">
                          <div className="conv-name">{otherUser?.username || 'Unknown'}</div>
                          <div className="conv-time">
                            {new Date(conv.lastMessage?.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="conv-last-message">
                          {conv.lastMessage?.content || 'No messages'}
                        </div>
                      </div>
                      {conv.unread > 0 && (
                        <div className="unread-badge">{conv.unread}</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="chat-area">
            {selectedChat ? (
              <>
                <div className="chat-header">
                  <div className="chat-user">
                    <div className="chat-avatar">
                      <span>A</span>
                    </div>
                    <div className="chat-user-info">
                      <div className="chat-user-name">Alex Johnson</div>
                      <div className="chat-user-status">Online</div>
                    </div>
                  </div>
                </div>

                <div className="chat-messages">
                  {messages.map((msg) => {
                    const isSent = msg.sender._id === currentUser?._id;
                    return (
                      <div key={msg._id} className={`message-group ${isSent ? 'sent' : 'received'}`}>
                        {!isSent && (
                          <div className="message-avatar">
                            {msg.sender.profilePhoto ? (
                              <img src={msg.sender.profilePhoto} alt={msg.sender.username} />
                            ) : (
                              <span>{msg.sender.username.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                        )}
                        <div className="message-content">
                          <div className="message-bubble">
                            {msg.content}
                          </div>
                          <div className="message-time">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {isTyping && (
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="chat-input-area">
                  <button type="button" className="btn-attachment">
                    📎
                  </button>
                  <input
                    type="text"
                    value={message}
                    onChange={handleTyping}
                    placeholder="Type a message..."
                    className="chat-input glossy"
                  />
                  <button type="submit" className="btn-send glossy-gold">
                    Send
                  </button>
                </form>
              </>
            ) : (
              <div className="no-chat-selected">
                <h3>Select a conversation</h3>
                <p>Choose a conversation from the sidebar to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Messages;
