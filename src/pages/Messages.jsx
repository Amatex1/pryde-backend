import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
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
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
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
          const response = await api.get(endpoint);
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

      fetchMessages();
      fetchChatInfo();
    }
  }, [selectedChat, selectedChatType]);

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

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedChat) return;

    try {
      if (selectedChatType === 'group') {
        // Send group message via API
        const response = await api.post('/messages', {
          groupChatId: selectedChat,
          content: message
        });
        setMessages((prev) => [...prev, response.data]);
      } else {
        // Send via Socket.IO for real-time delivery
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
      console.error('Error sending message:', error);
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
      <Navbar />
      
      <div className="messages-container">
        <div className="messages-layout glossy fade-in">
          <div className="conversations-sidebar">
            <div className="sidebar-header">
              <h2 className="sidebar-title">💬 Messages</h2>
              <div className="header-buttons">
                <button className="btn-new-chat" onClick={() => setShowNewChatModal(true)} title="New Chat">💬</button>
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
                        const otherUser = conv.lastMessage?.sender?._id === currentUser?._id
                          ? conv.lastMessage?.recipient
                          : conv.lastMessage?.sender;

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
                ) : null}
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
      </div>
    </div>
  );
}

export default Messages;
