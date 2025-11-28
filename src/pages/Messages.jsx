import React, { useState, useEffect, useRef } from 'react';
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
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'unread' or 'archived'
  const [replyingTo, setReplyingTo] = useState(null); // Message being replied to
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // Track which dropdown is open
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [mutedConversations, setMutedConversations] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openDropdown && !e.target.closest('.conv-actions')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdown]);

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
      const cleanupNewMessage = onNewMessage((newMessage) => {
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
      const cleanupMessageSent = onMessageSent((sentMessage) => {
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
      const cleanupTyping = onUserTyping((data) => {
        if (data.userId === selectedChat) {
          setIsTyping(data.isTyping);
        }
      });

      // Listen for online users list
      const cleanupOnlineUsers = onOnlineUsers((users) => {
        console.log('👥 Online users:', users);
        setOnlineUsers(users);
      });

      // Listen for users coming online
      const cleanupUserOnline = onUserOnline((data) => {
        console.log('✅ User came online:', data.userId);
        setOnlineUsers((prev) => {
          if (!prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          return prev;
        });
      });

      // Listen for users going offline
      const cleanupUserOffline = onUserOffline((data) => {
        console.log('❌ User went offline:', data.userId);
        setOnlineUsers((prev) => prev.filter(id => id !== data.userId));
      });

      // Return cleanup function
      return () => {
        cleanupNewMessage?.();
        cleanupMessageSent?.();
        cleanupTyping?.();
        cleanupOnlineUsers?.();
        cleanupUserOnline?.();
        cleanupUserOffline?.();
      };
    };

    if (socket.connected) {
      const cleanup = setupListeners();
      return () => {
        cleanup?.();
        socket.off('connect', setupListeners);
      };
    } else {
      socket.on('connect', setupListeners);
      return () => {
        socket.off('connect', setupListeners);
      };
    }
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

  // Conversation management functions
  const handleArchiveConversation = async (userId, isGroup = false) => {
    try {
      const endpoint = isGroup
        ? `/groupchats/${userId}/archive`
        : `/messages/conversations/${userId}/archive`;

      await api.post(endpoint);

      // Add to archived list
      setArchivedConversations(prev => [...prev, userId]);

      // Close dropdown
      setOpenDropdown(null);

      // Refresh conversations
      fetchConversations();
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  const handleUnarchiveConversation = async (userId, isGroup = false) => {
    try {
      const endpoint = isGroup
        ? `/groupchats/${userId}/unarchive`
        : `/messages/conversations/${userId}/unarchive`;

      await api.post(endpoint);

      // Remove from archived list
      setArchivedConversations(prev => prev.filter(id => id !== userId));

      // Refresh conversations
      fetchConversations();
    } catch (error) {
      console.error('Failed to unarchive conversation:', error);
    }
  };

  const handleMuteConversation = async (userId, isGroup = false, duration = null) => {
    try {
      const endpoint = isGroup
        ? `/groupchats/${userId}/mute`
        : `/messages/conversations/${userId}/mute`;

      await api.post(endpoint, { duration });

      // Add to muted list
      setMutedConversations(prev => [...prev, userId]);

      // Close dropdown
      setOpenDropdown(null);
    } catch (error) {
      console.error('Failed to mute conversation:', error);
    }
  };

  const handleUnmuteConversation = async (userId, isGroup = false) => {
    try {
      const endpoint = isGroup
        ? `/groupchats/${userId}/unmute`
        : `/messages/conversations/${userId}/unmute`;

      await api.post(endpoint);

      // Remove from muted list
      setMutedConversations(prev => prev.filter(id => id !== userId));
    } catch (error) {
      console.error('Failed to unmute conversation:', error);
    }
  };

  const handleMarkAsUnread = async (userId) => {
    try {
      await api.post(`/messages/conversations/${userId}/mark-unread`);

      // Close dropdown
      setOpenDropdown(null);

      // Refresh conversations
      fetchConversations();
    } catch (error) {
      console.error('Failed to mark as unread:', error);
    }
  };

  const handleDeleteConversation = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this entire conversation? This cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/messages/conversations/${userId}`);

      // Close dropdown
      setOpenDropdown(null);

      // Clear selected chat if it was the deleted one
      if (selectedChat === userId) {
        setSelectedChat(null);
        setSelectedChatType(null);
      }

      // Refresh conversations
      fetchConversations();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleBlockUser = async (userId) => {
    if (!window.confirm('Are you sure you want to block this user? They will not be able to message you or view your profile.')) {
      return;
    }

    try {
      await api.post('/blocks', { blockedUserId: userId });

      // Close dropdown
      setOpenDropdown(null);

      // Clear selected chat
      if (selectedChat === userId) {
        setSelectedChat(null);
        setSelectedChatType(null);
      }

      // Refresh conversations
      fetchConversations();

      alert('User blocked successfully');
    } catch (error) {
      console.error('Failed to block user:', error);
      alert('Failed to block user');
    }
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
          <div className={`conversations-sidebar ${selectedChat ? 'chat-active' : ''}`}>
            <div className="sidebar-header">
              <h2 className="sidebar-title">💬 Messages</h2>
              <div className="header-buttons">
                <button className="btn-new-chat" onClick={handleOpenNewChatModal} title="New Chat">💬</button>
                <button className="btn-new-chat" onClick={() => setShowNewGroupModal(true)} title="New Group">👥</button>
                <button className="btn-new-chat" onClick={() => setActiveTab('archived')} title="Archived">📦</button>
              </div>
            </div>

            {/* Tabs for All/Unread/Archived */}
            <div className="messages-tabs">
              <button
                className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All
              </button>
              <button
                className={`tab-button ${activeTab === 'unread' ? 'active' : ''}`}
                onClick={() => setActiveTab('unread')}
              >
                Unread
              </button>
              <button
                className={`tab-button ${activeTab === 'archived' ? 'active' : ''}`}
                onClick={() => setActiveTab('archived')}
              >
                Archived
              </button>
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
                      {groupChats
                        .filter(group => {
                          const isArchived = archivedConversations.includes(group._id);
                          if (activeTab === 'archived') return isArchived;
                          return !isArchived; // Show non-archived in 'all' and 'unread' tabs
                        })
                        .map((group) => (
                        <div
                          key={group._id}
                          className={`conversation-item ${selectedChat === group._id && selectedChatType === 'group' ? 'active' : ''}`}
                        >
                          <div
                            className="conv-clickable"
                            onClick={() => {
                              setSelectedChat(group._id);
                              setSelectedChatType('group');
                              setShowMobileSidebar(false);
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
                                {mutedConversations.includes(group._id) && '🔕 '}
                                {group.members?.length || 0} members
                              </div>
                            </div>
                          </div>

                          {/* 3-dot dropdown menu for groups */}
                          <div className="conv-actions">
                            <button
                              className="btn-conv-menu"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdown(openDropdown === group._id ? null : group._id);
                              }}
                            >
                              ⋮
                            </button>

                            {openDropdown === group._id && (
                              <div className="conv-dropdown">
                                {activeTab === 'archived' ? (
                                  <button onClick={(e) => { e.stopPropagation(); handleUnarchiveConversation(group._id, true); }}>
                                    📤 Unarchive
                                  </button>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); handleArchiveConversation(group._id, true); }}>
                                    📦 Archive
                                  </button>
                                )}
                                {mutedConversations.includes(group._id) ? (
                                  <button onClick={(e) => { e.stopPropagation(); handleUnmuteConversation(group._id, true); }}>
                                    🔔 Unmute
                                  </button>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); handleMuteConversation(group._id, true); }}>
                                    🔕 Mute
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Direct Messages */}
                  {conversations.length > 0 && (
                    <>
                      <div className="section-label">Direct Messages</div>
                      {conversations
                        .filter(conv => {
                          const isArchived = archivedConversations.includes(conv._id);
                          if (activeTab === 'archived') return isArchived;
                          if (activeTab === 'unread') return !isArchived && (conv.unread > 0 || conv.manuallyUnread);
                          return !isArchived; // 'all' tab shows non-archived
                        })
                        .map((conv) => {
                        // Use the otherUser field from backend, or fallback to lastMessage sender/recipient
                        const otherUser = conv.otherUser || (
                          conv.lastMessage?.sender?._id === currentUser?._id
                            ? conv.lastMessage?.recipient
                            : conv.lastMessage?.sender
                        );

                        return (
                          <div
                            key={conv._id}
                            className={`conversation-item ${selectedChat === conv._id && selectedChatType === 'user' ? 'active' : ''} ${conv.manuallyUnread ? 'manually-unread' : ''}`}
                          >
                            <div
                              className="conv-clickable"
                              onClick={() => {
                                setSelectedChat(conv._id);
                                setSelectedChatType('user');
                                setShowMobileSidebar(false);
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
                                  {mutedConversations.includes(conv._id) && '🔕 '}
                                  {conv.lastMessage?.content || 'No messages'}
                                </div>
                              </div>
                              {conv.unread > 0 && (
                                <div className="unread-badge">{conv.unread}</div>
                              )}
                            </div>

                            {/* 3-dot dropdown menu */}
                            <div className="conv-actions">
                              <button
                                className="btn-conv-menu"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdown(openDropdown === conv._id ? null : conv._id);
                                }}
                              >
                                ⋮
                              </button>

                              {openDropdown === conv._id && (
                                <div className="conv-dropdown">
                                  {activeTab !== 'archived' && (
                                    <button onClick={(e) => { e.stopPropagation(); handleMarkAsUnread(conv._id); }}>
                                      📧 Mark as Unread
                                    </button>
                                  )}
                                  {activeTab === 'archived' ? (
                                    <button onClick={(e) => { e.stopPropagation(); handleUnarchiveConversation(conv._id); }}>
                                      📤 Unarchive
                                    </button>
                                  ) : (
                                    <button onClick={(e) => { e.stopPropagation(); handleArchiveConversation(conv._id); }}>
                                      📦 Archive
                                    </button>
                                  )}
                                  {mutedConversations.includes(conv._id) ? (
                                    <button onClick={(e) => { e.stopPropagation(); handleUnmuteConversation(conv._id); }}>
                                      🔔 Unmute
                                    </button>
                                  ) : (
                                    <button onClick={(e) => { e.stopPropagation(); handleMuteConversation(conv._id); }}>
                                      🔕 Mute
                                    </button>
                                  )}
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv._id); }}>
                                    🗑️ Delete
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleBlockUser(otherUser?._id); }}
                                    className="danger"
                                  >
                                    🚫 Block User
                                  </button>
                                </div>
                              )}
                            </div>
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

          <div className={`chat-area ${selectedChat ? 'active' : ''}`}>
            {selectedChat ? (
              <>
                <div className="chat-header">
                  {/* Mobile Back Button */}
                  <button
                    className="mobile-back-btn"
                    onClick={() => {
                      setSelectedChat(null);
                      setSelectedChatType(null);
                    }}
                    aria-label="Back to conversations"
                  >
                    ← Back
                  </button>
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
                        {mutedConversations.includes(selectedChat) && <span className="muted-indicator">🔕</span>}
                      </div>
                      {selectedChatType !== 'group' && (
                        <div className={`chat-user-status ${onlineUsers.includes(selectedChat) ? 'online' : 'offline'}`}>
                          {onlineUsers.includes(selectedChat) ? 'Online' : 'Offline'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chat Settings Button */}
                  <button
                    className="btn-chat-settings"
                    onClick={() => {
                      if (mutedConversations.includes(selectedChat)) {
                        handleUnmuteConversation(selectedChat, selectedChatType === 'group');
                      } else {
                        handleMuteConversation(selectedChat, selectedChatType === 'group');
                      }
                    }}
                    title={mutedConversations.includes(selectedChat) ? 'Unmute notifications' : 'Mute notifications'}
                  >
                    {mutedConversations.includes(selectedChat) ? '🔔' : '🔕'}
                  </button>
                </div>

                <div className="chat-messages">
                  {messages.map((msg, index) => {
                    const isSent = msg.sender._id === currentUser?._id;
                    const isEditing = editingMessageId === msg._id;
                    const previousMsg = index > 0 ? messages[index - 1] : null;
                    const showDateHeader = shouldShowDateHeader(msg, previousMsg);

                    return (
                      <React.Fragment key={msg._id}>
                        {/* Date Header */}
                        {showDateHeader && (
                          <div className="message-date-header">
                            <span>{formatDateHeader(msg.createdAt)}</span>
                          </div>
                        )}

                        <div className={`message-group ${isSent ? 'sent' : 'received'}`}>
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

                              {msg.edited && <div className="message-edited-indicator">(edited)</div>}

                              <div className="message-actions">
                                <button
                                  onClick={() => setReplyingTo(msg)}
                                  className="btn-message-action"
                                  title="Reply to message"
                                >
                                  ↩️
                                </button>
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
                      </React.Fragment>
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
                  {replyingTo && (
                    <div className="reply-preview">
                      <div className="reply-preview-content">
                        <div className="reply-preview-label">Replying to {replyingTo.sender.displayName || replyingTo.sender.username}</div>
                        <div className="reply-preview-text">{replyingTo.content}</div>
                      </div>
                      <button
                        type="button"
                        className="btn-cancel-reply"
                        onClick={() => setReplyingTo(null)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <div className="chat-input-wrapper">
                    <button type="button" className="btn-attachment">
                      📎
                    </button>
                    <input
                      type="text"
                      value={message}
                      onChange={handleTyping}
                      placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
                      className="chat-input glossy"
                    />
                    <button type="submit" className="btn-send glossy-gold">
                      Send
                    </button>
                  </div>
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
                        className={`user-result ${friend.isActive === false ? 'deactivated-user' : ''}`}
                        onClick={() => {
                          if (friend.isActive === false) {
                            alert('You cannot message this user. Their account has been deactivated.');
                          } else {
                            handleStartChat(friend._id);
                          }
                        }}
                        style={{ cursor: friend.isActive === false ? 'not-allowed' : 'pointer' }}
                      >
                        <div className="user-avatar">
                          {friend.isActive === false ? (
                            <span>?</span>
                          ) : friend.profilePhoto ? (
                            <img src={getImageUrl(friend.profilePhoto)} alt={friend.username} />
                          ) : (
                            <span>{friend.displayName?.charAt(0).toUpperCase() || friend.username?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="user-info">
                          <div className={`user-name ${friend.isActive === false ? 'deactivated-text' : ''}`}>
                            {friend.displayName || friend.username}
                          </div>
                          <div className={`user-username ${friend.isActive === false ? 'deactivated-text' : ''}`}>
                            @{friend.username}
                          </div>
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
