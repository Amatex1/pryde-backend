import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import EmojiPicker from '../components/EmojiPicker';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
import {
  onNewMessage,
  onMessageSent,
  sendMessage as socketSendMessage,
  emitTyping,
  onUserTyping,
  isSocketConnected,
  getSocket,
  onUserOnline,
  onUserOffline,
  onOnlineUsers
} from '../utils/socket';
import './Messages.css';

function Messages({ onOpenMiniChat }) {
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedChatType, setSelectedChatType] = useState('user'); // 'user' or 'group'
  const [selectedUser, setSelectedUser] = useState(null); // Store selected user info
  const [selectedGroup, setSelectedGroup] = useState(null); // Store selected group info
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactingToMessage, setReactingToMessage] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'unread'
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

    // Log socket connection status
    console.log('🔌 Socket connection status:', isSocketConnected());
    const socket = getSocket();
    if (socket) {
      console.log('✅ Socket instance exists');
      socket.on('connect', () => {
        console.log('✅ Socket connected!');
      });
      socket.on('disconnect', () => {
        console.log('❌ Socket disconnected!');
      });
      socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
      });
    } else {
      console.error('❌ Socket instance not found!');
    }
  }, []);

  // Fetch conversations and group chats
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const [messagesRes, groupsRes] = await Promise.all([
          api.get('/messages'),
          api.get('/groupChats')
        ]);
        setConversations(messagesRes.data);
        setGroupChats(groupsRes.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching conversations:', error);
        setLoading(false);
      }
    };
    fetchConversations();
  }, []);

  // Fetch messages and user/group info for selected chat
  useEffect(() => {
    if (selectedChat) {
      const fetchMessages = async () => {
        try {
          const endpoint = selectedChatType === 'group'
            ? `/messages/group/${selectedChat}`
            : `/messages/${selectedChat}`;
          console.log('📥 Fetching messages from:', endpoint);
          const response = await api.get(endpoint);
          console.log('✅ Loaded messages:', response.data.length);
          setMessages(response.data);
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      };

      const fetchChatInfo = async () => {
        try {
          if (selectedChatType === 'group') {
            const response = await api.get(`/groupchats/${selectedChat}`);
            setSelectedGroup(response.data);
            setSelectedUser(null);
          } else {
            const response = await api.get(`/users/${selectedChat}`);
            setSelectedUser(response.data);
            setSelectedGroup(null);
          }
        } catch (error) {
          console.error('Error fetching chat info:', error);
        }
      };

      // Clear messages first to show loading state
      setMessages([]);
      fetchMessages();
      fetchChatInfo();
    }
  }, [selectedChat, selectedChatType]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket.IO listeners - wait for socket to be ready
  useEffect(() => {
    const socket = getSocket();

    if (!socket) {
      console.warn('⚠️ Socket not initialized yet, waiting...');
      return;
    }

    // Ensure socket is connected before setting up listeners
    const setupListeners = () => {
      console.log('🎧 Setting up socket listeners');

      // Listen for new messages
      onNewMessage((newMessage) => {
        console.log('📨 Received new_message event:', newMessage);
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
        console.log('✅ Received message_sent event:', sentMessage);
        setMessages((prev) => [...prev, sentMessage]);

        // Update conversations list with the sent message
        setConversations((prev) => {
          const recipientId = sentMessage.recipient._id;
          const updated = prev.filter(c => c._id !== recipientId);
          return [{ _id: recipientId, lastMessage: sentMessage, ...sentMessage.recipient }, ...updated];
        });
      });

      // Listen for typing indicator
      onUserTyping((data) => {
        if (data.userId === selectedChat) {
          setIsTyping(data.isTyping);
        }
      });

      // Listen for online users list
      onOnlineUsers((users) => {
        console.log('👥 Online users:', users);
        setOnlineUsers(users);
      });

      // Listen for users coming online
      onUserOnline((data) => {
        console.log('✅ User came online:', data.userId);
        setOnlineUsers((prev) => {
          if (!prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          return prev;
        });
      });

      // Listen for users going offline
      onUserOffline((data) => {
        console.log('❌ User went offline:', data.userId);
        setOnlineUsers((prev) => prev.filter(id => id !== data.userId));
      });
    };

    if (socket.connected) {
      setupListeners();
    } else {
      socket.on('connect', setupListeners);
    }

    return () => {
      socket.off('connect', setupListeners);
    };
  }, [selectedChat]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedChat) return;

    console.log('📤 Sending message:', {
      recipientId: selectedChat,
      content: message,
      chatType: selectedChatType,
      socketConnected: isSocketConnected()
    });

    try {
      if (selectedChatType === 'group') {
        // Send group message via API
        const response = await api.post('/messages', {
          groupChatId: selectedChat,
          content: message
        });
        setMessages((prev) => [...prev, response.data]);
      } else {
        // Check if socket is connected
        if (!isSocketConnected()) {
          console.error('❌ Socket not connected!');
          alert('Connection lost. Please refresh the page.');
          return;
        }

        // Send via Socket.IO for real-time delivery
        console.log('🔌 Emitting send_message via socket');
        socketSendMessage({
          recipientId: selectedChat,
          content: message
        });
      }
      setMessage('');

      // Clear typing indicator
      if (currentUser) {
        emitTyping(selectedChat, currentUser._id);
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      alert('Failed to send message');
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

  const handleEditMessage = (messageId, content) => {
    setEditingMessageId(messageId);
    setEditMessageText(content);
  };

  const handleSaveEditMessage = async (messageId) => {
    if (!editMessageText.trim()) return;

    try {
      const response = await api.put(`/messages/${messageId}`, {
        content: editMessageText
      });

      // Update the message in the list
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? response.data : msg))
      );

      setEditingMessageId(null);
      setEditMessageText('');
    } catch (error) {
      console.error('❌ Error editing message:', error);
      alert('Failed to edit message');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditMessageText('');
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      await api.delete(`/messages/${messageId}`);

      // Remove the message from the list
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    } catch (error) {
      console.error('❌ Error deleting message:', error);
      alert('Failed to delete message');
    }
  };

  const handleReactToMessage = (messageId) => {
    setReactingToMessage(messageId);
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = async (emoji) => {
    if (!reactingToMessage) return;

    try {
      const response = await api.post(`/messages/${reactingToMessage}/react`, { emoji });

      // Update the message in the list with new reactions
      setMessages((prev) =>
        prev.map((msg) => (msg._id === reactingToMessage ? response.data : msg))
      );
    } catch (error) {
      console.error('❌ Error adding reaction:', error);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      }
    }
  };

  const handleRemoveReaction = async (messageId, emoji) => {
    try {
      const response = await api.delete(`/messages/${messageId}/react`, {
        data: { emoji }
      });

      // Update the message in the list
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? response.data : msg))
      );
    } catch (error) {
      console.error('❌ Error removing reaction:', error);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await api.get('/friends');
      setFriends(response.data);
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  const handleSearchUsers = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const response = await api.get(`/users/search?q=${searchQuery}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleStartChat = (userId) => {
    setSelectedChat(userId);
    setSelectedChatType('user');
    setShowNewChatModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleOpenNewChatModal = () => {
    setShowNewChatModal(true);
    fetchFriends();
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0) {
      alert('Please enter a group name and select at least one member');
      return;
    }

    try {
      const response = await api.post('/groupChats/create', {
        name: groupName,
        description: groupDescription,
        memberIds: selectedMembers
      });

      setGroupChats([response.data, ...groupChats]);
      setSelectedChat(response.data._id);
      setSelectedChatType('group');
      setShowNewGroupModal(false);
      setGroupName('');
      setGroupDescription('');
      setSelectedMembers([]);
      setSearchResults([]);
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create group chat');
    }
  };

  const toggleMemberSelection = (userId) => {
    if (selectedMembers.includes(userId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== userId));
    } else {
      setSelectedMembers([...selectedMembers, userId]);
    }
  };

  return (
    <div className="page-container">
      <Navbar onOpenMiniChat={onOpenMiniChat} />
      
      <div className="messages-container">
        <div className="messages-layout glossy fade-in">
          <div className="conversations-sidebar">
            <div className="sidebar-header">
              <h2 className="sidebar-title">💬 Messages</h2>
              <div className="header-buttons">
                <button className="btn-new-chat" onClick={handleOpenNewChatModal} title="New Chat">💬</button>
                <button className="btn-new-chat" onClick={() => setShowNewGroupModal(true)} title="New Group">👥</button>
              </div>
            </div>

            <div className="conversations-list">
              {loading ? (
                <div className="loading-state">Loading conversations...</div>
              ) : (
                <>
                  {/* Group Chats */}
                  {groupChats.length > 0 && (
                    <>
                      <div className="section-label">Groups</div>
                      {groupChats.map((group) => (
                        <div
                          key={group._id}
                          className={`conversation-item ${selectedChat === group._id && selectedChatType === 'group' ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedChat(group._id);
                            setSelectedChatType('group');
                          }}
                        >
                          <div className="conv-avatar group-avatar">
                            {group.avatar ? (
                              <img src={group.avatar} alt={group.name} />
                            ) : (
                              <span>👥</span>
                            )}
                          </div>
                          <div className="conv-info">
                            <div className="conv-header">
                              <div className="conv-name">{group.name}</div>
                              <div className="conv-time">
                                {group.lastMessage ? new Date(group.updatedAt).toLocaleTimeString() : ''}
                              </div>
                            </div>
                            <div className="conv-last-message">
                              {group.members?.length || 0} members
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Direct Messages */}
                  {conversations.length > 0 && (
                    <>
                      <div className="section-label">Direct Messages</div>
                      {conversations.map((conv) => {
                        // Use the otherUser field from backend, or fallback to lastMessage sender/recipient
                        const otherUser = conv.otherUser || (
                          conv.lastMessage?.sender?._id === currentUser?._id
                            ? conv.lastMessage?.recipient
                            : conv.lastMessage?.sender
                        );

                        return (
                          <div
                            key={conv._id}
                            className={`conversation-item ${selectedChat === conv._id && selectedChatType === 'user' ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedChat(conv._id);
                              setSelectedChatType('user');
                            }}
                          >
                      <div className="conv-avatar">
                        {otherUser?.profilePhoto ? (
                          <img src={getImageUrl(otherUser.profilePhoto)} alt={otherUser.username} />
                        ) : (
                          <span>{otherUser?.username?.charAt(0).toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <div className="conv-info">
                        <div className="conv-header">
                          <div className="conv-name">{otherUser?.displayName || otherUser?.username || 'Unknown'}</div>
                          <div className="conv-time">
                            {conv.lastMessage?.createdAt ? new Date(conv.lastMessage.createdAt).toLocaleTimeString() : ''}
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
                      })}
                    </>
                  )}

                  {conversations.length === 0 && groupChats.length === 0 && (
                    <div className="empty-state">No conversations yet</div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="chat-area">
            {selectedChat ? (
              <>
                <div className="chat-header">
                  <div className="chat-user">
                    <div className="chat-avatar">
                      {selectedChatType === 'group' ? (
                        <span>{selectedGroup?.name?.charAt(0).toUpperCase() || 'G'}</span>
                      ) : selectedUser?.profilePhoto ? (
                        <img src={getImageUrl(selectedUser.profilePhoto)} alt={selectedUser.username} />
                      ) : (
                        <span>{selectedUser?.displayName?.charAt(0).toUpperCase() || selectedUser?.username?.charAt(0).toUpperCase() || 'U'}</span>
                      )}
                    </div>
                    <div className="chat-user-info">
                      <div className="chat-user-name">
                        {selectedChatType === 'group'
                          ? selectedGroup?.name || 'Group Chat'
                          : selectedUser?.displayName || selectedUser?.username || 'User'}
                      </div>
                      {selectedChatType !== 'group' && (
                        <div className={`chat-user-status ${onlineUsers.includes(selectedChat) ? 'online' : 'offline'}`}>
                          {onlineUsers.includes(selectedChat) ? 'Online' : 'Offline'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="chat-messages">
                  {messages.map((msg) => {
                    const isSent = msg.sender._id === currentUser?._id;
                    const isEditing = editingMessageId === msg._id;

                    return (
                      <div key={msg._id} className={`message-group ${isSent ? 'sent' : 'received'}`}>
                        {!isSent && (
                          <div className="message-avatar">
                            {msg.sender.profilePhoto ? (
                              <img src={getImageUrl(msg.sender.profilePhoto)} alt={msg.sender.username} />
                            ) : (
                              <span>{msg.sender.username?.charAt(0).toUpperCase() || 'U'}</span>
                            )}
                          </div>
                        )}
                        <div className="message-content">
                          {selectedChatType === 'group' && !isSent && (
                            <div className="message-sender-name">{msg.sender.displayName || msg.sender.username}</div>
                          )}

                          {isEditing ? (
                            <div className="message-edit-box">
                              <input
                                type="text"
                                value={editMessageText}
                                onChange={(e) => setEditMessageText(e.target.value)}
                                className="message-edit-input"
                                autoFocus
                              />
                              <div className="message-edit-actions">
                                <button onClick={() => handleSaveEditMessage(msg._id)} className="btn-save-edit">
                                  ✓
                                </button>
                                <button onClick={handleCancelEdit} className="btn-cancel-edit">
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="message-bubble">
                                {msg.content}
                                {msg.edited && <span className="edited-indicator"> (edited)</span>}

                                {/* Display reactions */}
                                {msg.reactions && msg.reactions.length > 0 && (
                                  <div className="message-reactions">
                                    {Object.entries(
                                      msg.reactions.reduce((acc, reaction) => {
                                        acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                                        return acc;
                                      }, {})
                                    ).map(([emoji, count]) => {
                                      const userReacted = msg.reactions.some(
                                        r => r.emoji === emoji && r.user._id === currentUser?._id
                                      );
                                      return (
                                        <button
                                          key={emoji}
                                          className={`reaction-badge ${userReacted ? 'user-reacted' : ''}`}
                                          onClick={() => userReacted ? handleRemoveReaction(msg._id, emoji) : null}
                                          title={userReacted ? 'Click to remove' : ''}
                                        >
                                          {emoji} {count}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              <div className="message-actions">
                                <button
                                  onClick={() => handleReactToMessage(msg._id)}
                                  className="btn-message-action"
                                  title="React to message"
                                >
                                  😊
                                </button>
                                {isSent && (
                                  <>
                                    <button
                                      onClick={() => handleEditMessage(msg._id, msg.content)}
                                      className="btn-message-action"
                                      title="Edit message"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMessage(msg._id)}
                                      className="btn-message-action"
                                      title="Delete message"
                                    >
                                      🗑️
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}

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

        {/* New Chat Modal */}
        {showNewChatModal && (
          <div className="modal-overlay" onClick={() => setShowNewChatModal(false)}>
            <div className="modal-content glossy" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>New Message</h2>
                <button className="btn-close" onClick={() => setShowNewChatModal(false)}>×</button>
              </div>

              <form onSubmit={handleSearchUsers} className="search-form">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for users..."
                  className="search-input glossy"
                  autoFocus
                />
                <button type="submit" disabled={searchLoading} className="btn-search glossy-gold">
                  {searchLoading ? 'Searching...' : 'Search'}
                </button>
              </form>

              <div className="search-results">
                {searchResults.length > 0 ? (
                  // Show search results
                  searchResults.map((user) => (
                    <div
                      key={user._id}
                      className="user-result"
                      onClick={() => handleStartChat(user._id)}
                    >
                      <div className="user-avatar">
                        {user.profilePhoto ? (
                          <img src={getImageUrl(user.profilePhoto)} alt={user.username} />
                        ) : (
                          <span>{user.displayName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="user-info">
                        <div className="user-name">{user.displayName || user.username}</div>
                        <div className="user-username">@{user.username}</div>
                      </div>
                    </div>
                  ))
                ) : searchQuery && !searchLoading ? (
                  <div className="no-results">No users found</div>
                ) : friends.length > 0 ? (
                  // Show friends list when no search query
                  <>
                    <div className="friends-list-header">Your Friends</div>
                    {friends.map((friend) => (
                      <div
                        key={friend._id}
                        className="user-result"
                        onClick={() => handleStartChat(friend._id)}
                      >
                        <div className="user-avatar">
                          {friend.profilePhoto ? (
                            <img src={getImageUrl(friend.profilePhoto)} alt={friend.username} />
                          ) : (
                            <span>{friend.displayName?.charAt(0).toUpperCase() || friend.username?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{friend.displayName || friend.username}</div>
                          <div className="user-username">@{friend.username}</div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="no-results">No friends yet. Search for users to start chatting!</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* New Group Modal */}
        {showNewGroupModal && (
          <div className="modal-overlay" onClick={() => setShowNewGroupModal(false)}>
            <div className="modal-content glossy" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create Group Chat</h2>
                <button className="btn-close" onClick={() => setShowNewGroupModal(false)}>×</button>
              </div>

              <form onSubmit={handleCreateGroup} className="group-form">
                <div className="form-group">
                  <label>Group Name *</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Enter group name..."
                    className="search-input glossy"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description (optional)</label>
                  <textarea
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="Enter group description..."
                    className="search-input glossy"
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>Search and Add Members *</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value.trim()) {
                        handleSearchUsers(e);
                      }
                    }}
                    placeholder="Search for users..."
                    className="search-input glossy"
                  />
                </div>

                {selectedMembers.length > 0 && (
                  <div className="selected-members">
                    <label>Selected Members ({selectedMembers.length})</label>
                    <div className="members-chips">
                      {searchResults.filter(u => selectedMembers.includes(u._id)).map(user => (
                        <div key={user._id} className="member-chip">
                          {user.displayName || user.username}
                          <button type="button" onClick={() => toggleMemberSelection(user._id)}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="search-results">
                  {searchResults.length > 0 ? (
                    searchResults.map((user) => (
                      <div
                        key={user._id}
                        className={`user-result ${selectedMembers.includes(user._id) ? 'selected' : ''}`}
                        onClick={() => toggleMemberSelection(user._id)}
                      >
                        <div className="user-avatar">
                          {user.profilePhoto ? (
                            <img src={getImageUrl(user.profilePhoto)} alt={user.username} />
                          ) : (
                            <span>{user.displayName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{user.displayName || user.username}</div>
                          <div className="user-username">@{user.username}</div>
                        </div>
                        {selectedMembers.includes(user._id) && <span className="check-mark">✓</span>}
                      </div>
                    ))
                  ) : searchQuery && !searchLoading ? (
                    <div className="no-results">No users found</div>
                  ) : null}
                </div>

                <button type="submit" className="btn-create-group" disabled={!groupName.trim() || selectedMembers.length === 0}>
                  Create Group
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Emoji Picker Modal */}
        {showEmojiPicker && (
          <EmojiPicker
            onEmojiSelect={handleEmojiSelect}
            onClose={() => {
              setShowEmojiPicker(false);
              setReactingToMessage(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default Messages;
