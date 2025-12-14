import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import EmojiPicker from '../components/EmojiPicker';
import GifPicker from '../components/GifPicker';
import CustomModal from '../components/CustomModal';
import MessageSearch from '../components/MessageSearch';
import VoiceRecorder from '../components/VoiceRecorder';
import AudioPlayer from '../components/AudioPlayer';
import { useModal } from '../hooks/useModal';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
import { getUserChatColor, getSentMessageColor } from '../utils/chatColors';
import logger from '../utils/logger';
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
  onOnlineUsers,
  requestOnlineUsers
} from '../utils/socket';
import './Messages.css';
import '../styles/themes/messages.css';

function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { modalState, closeModal, showAlert, showConfirm } = useModal();

  // Restore selected chat from localStorage on mount
  const [selectedChat, setSelectedChat] = useState(() => {
    const saved = localStorage.getItem('selectedChat');
    return saved || null;
  });
  const [selectedChatType, setSelectedChatType] = useState(() => {
    const saved = localStorage.getItem('selectedChatType');
    return saved || 'user';
  });
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
  const [currentTheme, setCurrentTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');
  const [quietMode, setQuietMode] = useState(document.documentElement.getAttribute('data-quiet-mode') === 'true');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGif, setSelectedGif] = useState(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [contentWarning, setContentWarning] = useState('');
  const [showContentWarning, setShowContentWarning] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // Listen for theme and quiet mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      const quiet = document.documentElement.getAttribute('data-quiet-mode') === 'true';
      setCurrentTheme(theme);
      setQuietMode(quiet);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-quiet-mode']
    });

    return () => observer.disconnect();
  }, []);

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

  // Save selected chat to localStorage whenever it changes
  useEffect(() => {
    if (selectedChat) {
      localStorage.setItem('selectedChat', selectedChat);
      localStorage.setItem('selectedChatType', selectedChatType);
    }
  }, [selectedChat, selectedChatType]);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/auth/me');
        setCurrentUser(response.data);
      } catch (error) {
        logger.error('Error fetching user:', error);
      }
    };
    fetchCurrentUser();

    // Log socket connection status (but don't add listeners here - they're added in the other useEffect)
    logger.debug('🔌 Socket connection status:', isSocketConnected());
    const socket = getSocket();
    if (socket) {
      logger.debug('✅ Socket instance exists');
    } else {
      logger.error('❌ Socket instance not found!');
    }
  }, []);

  // Check for chat parameter in URL and open that chat
  useEffect(() => {
    const chatId = searchParams.get('chat');
    if (chatId) {
      setSelectedChat(chatId);
      setSelectedChatType('user');
      // Remove the parameter from URL after opening the chat
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

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
        logger.error('Error fetching conversations:', error);
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
          logger.debug('📥 Fetching messages from:', endpoint);
          const response = await api.get(endpoint);
          logger.debug('✅ Loaded messages:', response.data.length);
          setMessages(response.data);

          // Mark all unread messages as read and remove manual unread status
          if (selectedChatType === 'user') {
            const unreadMessages = response.data.filter(
              msg => msg.sender._id === selectedChat && !msg.read
            );

            for (const msg of unreadMessages) {
              try {
                await api.put(`/messages/${msg._id}/read`);
              } catch (error) {
                logger.error('Error marking message as read:', error);
              }
            }

            // Remove manual unread status
            try {
              await api.delete(`/messages/conversations/${selectedChat}/mark-unread`);
            } catch (error) {
              logger.error('Error removing manual unread status:', error);
            }

            // Refresh conversations to update unread counts
            if (unreadMessages.length > 0) {
              fetchConversations();
            }
          }
        } catch (error) {
          logger.error('Error fetching messages:', error);
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
          logger.error('Error fetching chat info:', error);
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

  // Socket.IO listeners for online/offline status - set up ONCE on mount
  useEffect(() => {
    const cleanupFunctions = [];

    const setupListeners = () => {
      logger.debug('🔌 Setting up online/offline status listeners in Messages');

      // Listen for online users list
      const cleanupOnlineUsers = onOnlineUsers((users) => {
        logger.debug('👥 Online users:', users);
        setOnlineUsers(users);
      });
      cleanupFunctions.push(cleanupOnlineUsers);

      // Listen for users coming online
      const cleanupUserOnline = onUserOnline((data) => {
        logger.debug('✅ User came online:', data.userId);
        setOnlineUsers((prev) => {
          if (!prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          return prev;
        });
      });
      cleanupFunctions.push(cleanupUserOnline);

      // Listen for users going offline
      const cleanupUserOffline = onUserOffline((data) => {
        logger.debug('❌ User went offline:', data.userId);
        setOnlineUsers((prev) => prev.filter(id => id !== data.userId));
      });
      cleanupFunctions.push(cleanupUserOffline);
    };

    // Try to get socket, retry if not available yet
    const checkSocket = () => {
      const socket = getSocket();

      if (!socket) {
        logger.debug('⏳ Socket not initialized yet, retrying in 100ms...');
        setTimeout(checkSocket, 100);
        return;
      }

      logger.debug('✅ Socket found, checking connection status');

      // Set up listeners if already connected, or wait for connection
      if (socket.connected) {
        logger.debug('✅ Socket already connected, setting up listeners');
        setupListeners();
        // Request online users list (important for mobile/slow connections)
        setTimeout(() => requestOnlineUsers(), 500);
      } else {
        logger.debug('⏳ Socket not connected yet, waiting for connection...');
        const onConnect = () => {
          logger.debug('✅ Socket connected, setting up listeners');
          setupListeners();
          // Request online users list (important for mobile/slow connections)
          setTimeout(() => requestOnlineUsers(), 500);
        };
        socket.once('connect', onConnect);
      }
    };

    checkSocket();

    // Cleanup on unmount
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup?.());
    };
  }, []); // Empty dependency array - only run once on mount

  // Socket.IO listeners for messages and typing - depend on selectedChat
  useEffect(() => {
    // Ensure socket is connected before setting up listeners
    const setupListeners = () => {
      const socket = getSocket();

      if (!socket) {
        logger.warn('⚠️ Socket not initialized yet for message listeners, retrying...');
        setTimeout(setupListeners, 100);
        return null;
      }
      logger.debug('🎧 Setting up message socket listeners for chat:', selectedChat);

      // Listen for new messages
      const cleanupNewMessage = onNewMessage((newMessage) => {
        logger.debug('📨 Received new_message event:', newMessage);

        // Check if this message is for the currently selected chat
        // Message is relevant if the sender is the selected chat OR the recipient is the selected chat
        const isRelevantMessage =
          selectedChat === newMessage.sender._id ||
          selectedChat === newMessage.recipient._id;

        if (isRelevantMessage) {
          logger.debug('✅ Message is for selected chat, adding to messages');
          setMessages((prev) => {
            // Prevent duplicates - check if message already exists
            if (prev.some(msg => msg._id === newMessage._id)) {
              logger.debug('⚠️ Message already exists, skipping');
              return prev;
            }
            return [...prev, newMessage];
          });
        }

        // Update conversations list - show the conversation with the OTHER person
        const otherPersonId = currentUser?._id === newMessage.sender._id
          ? newMessage.recipient._id
          : newMessage.sender._id;

        const otherPerson = currentUser?._id === newMessage.sender._id
          ? newMessage.recipient
          : newMessage.sender;

        setConversations((prev) => {
          const updated = prev.filter(c => c._id !== otherPersonId);
          return [{ _id: otherPersonId, lastMessage: newMessage, ...otherPerson }, ...updated];
        });
      });

      // Listen for sent message confirmation
      const cleanupMessageSent = onMessageSent((sentMessage) => {
        logger.debug('✅ Received message_sent event:', sentMessage);

        // Only add to messages if this is the selected chat
        if (selectedChat === sentMessage.recipient._id) {
          logger.debug('✅ Sent message is for selected chat, adding to messages');
          setMessages((prev) => {
            // Prevent duplicates - check if message already exists
            if (prev.some(msg => msg._id === sentMessage._id)) {
              logger.debug('⚠️ Message already exists, skipping');
              return prev;
            }
            return [...prev, sentMessage];
          });
        }

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

      // Return cleanup function
      return () => {
        cleanupNewMessage?.();
        cleanupMessageSent?.();
        cleanupTyping?.();
      };
    };

    const cleanup = setupListeners();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [selectedChat, currentUser]);

  const handleSendMessage = async (e, voiceNote = null) => {
    if (e) e.preventDefault();
    if ((!message.trim() && !selectedFile && !selectedGif && !voiceNote) || !selectedChat) return;

    // Use GIF URL if selected, otherwise use file attachment
    const attachmentUrl = selectedGif || selectedFile?.url;

    logger.debug('📤 Sending message:', {
      recipientId: selectedChat,
      content: message,
      attachment: attachmentUrl,
      contentWarning: contentWarning,
      chatType: selectedChatType,
      socketConnected: isSocketConnected()
    });

    try {
      if (selectedChatType === 'group') {
        // Send group message via API
        const response = await api.post('/messages', {
          groupChatId: selectedChat,
          content: message,
          attachment: attachmentUrl,
          voiceNote: voiceNote,
          contentWarning: contentWarning
        });
        setMessages((prev) => [...prev, response.data]);
      } else {
        // Check if socket is connected
        if (!isSocketConnected()) {
          logger.error('❌ Socket not connected!');
          alert('Connection lost. Please refresh the page.');
          return;
        }

        // Send via Socket.IO for real-time delivery
        logger.debug('🔌 Emitting send_message via socket');
        socketSendMessage({
          recipientId: selectedChat,
          content: message,
          attachment: attachmentUrl,
          voiceNote: voiceNote,
          contentWarning: contentWarning
        });
      }
      setMessage('');
      setSelectedFile(null);
      setSelectedGif(null);
      setContentWarning('');
      setShowContentWarning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Clear typing indicator
      if (currentUser) {
        emitTyping(selectedChat, currentUser._id);
      }
    } catch (error) {
      logger.error('❌ Error sending message:', error);
      alert('Failed to send message');
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/ogg'];
    if (!validTypes.includes(file.type)) {
      showAlert('Please select only images (JPEG, PNG, GIF) or videos (MP4, WebM, OGG)', 'Invalid File Type');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      showAlert('File size must be less than 10MB', 'File Too Large');
      return;
    }

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/upload/chat-attachment', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSelectedFile({ url: response.data.url, name: file.name, type: file.type });
    } catch (error) {
      logger.error('File upload failed:', error);
      showAlert('Failed to upload file. Please try again.', 'Upload Failed');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      logger.error('❌ Error editing message:', error);
      showAlert('Failed to edit message. Please try again.', 'Edit Failed');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditMessageText('');
  };

  const handleDeleteMessage = async (messageId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this message?',
      'Delete Message',
      'Delete',
      'Cancel'
    );
    if (!confirmed) return;

    try {
      await api.delete(`/messages/${messageId}`);

      // Remove the message from the list
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    } catch (error) {
      logger.error('❌ Error deleting message:', error);
      showAlert('Failed to delete message. Please try again.', 'Delete Failed');
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
      logger.error('❌ Error adding reaction:', error);
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
      logger.error('❌ Error removing reaction:', error);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await api.get('/friends');
      setFriends(response.data);
    } catch (error) {
      logger.error('Failed to fetch friends:', error);
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
      logger.error('Search failed:', error);
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
      logger.error('Failed to archive conversation:', error);
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
      logger.error('Failed to unarchive conversation:', error);
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
      logger.error('Failed to mute conversation:', error);
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
      logger.error('Failed to unmute conversation:', error);
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
      logger.error('Failed to mark as unread:', error);
    }
  };

  const handleMarkAsRead = async (userId) => {
    try {
      await api.delete(`/messages/conversations/${userId}/mark-unread`);

      // Refresh conversations
      fetchConversations();
    } catch (error) {
      logger.error('Failed to mark as read:', error);
    }
  };

  const handleDeleteConversation = async (userId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this entire conversation? This cannot be undone.',
      'Delete Conversation',
      'Delete',
      'Cancel'
    );
    if (!confirmed) return;

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
      logger.error('Failed to delete conversation:', error);
      showAlert('Failed to delete conversation. Please try again.', 'Delete Failed');
    }
  };

  const handleBlockUser = async (userId) => {
    const confirmed = await showConfirm(
      'Are you sure you want to block this user? They will not be able to message you or view your profile.',
      'Block User',
      'Block',
      'Cancel'
    );
    if (!confirmed) return;

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

      showAlert('User blocked successfully', 'User Blocked');
    } catch (error) {
      logger.error('Failed to block user:', error);
      showAlert('Failed to block user. Please try again.', 'Block Failed');
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
      logger.error('Failed to create group:', error);
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
    <div
      className="page-container messages-page"
      data-theme={currentTheme}
      data-quiet-mode={quietMode ? 'true' : 'false'}
    >
      <Navbar />

      <div className="messages-container">
        <div className="messages-layout glossy fade-in">
          <div className={`conversations-sidebar ${selectedChat ? 'chat-active' : ''}`}>
            <div className="sidebar-header">
              <h2 className="sidebar-title">💬 Messages</h2>
              <div className="header-buttons">
                <button className="btn-new-chat" onClick={handleOpenNewChatModal} title="New Chat">💬</button>
                {/* Group chat hidden for Plan A - keeping backend for future */}
                {/* <button className="btn-new-chat" onClick={() => setShowNewGroupModal(true)} title="New Group">👥</button> */}
                <button className="btn-new-chat" onClick={() => setActiveTab('archived')} title="Archived">📦</button>
              </div>
            </div>

            {/* Message Search */}
            <div className="message-search-container">
              <MessageSearch conversationWith={selectedChat} />
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
                  {/* Group Chats - Hidden for Plan A */}
                  {false && groupChats.length > 0 && (
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
                            className={`conversation-item ${selectedChat === conv._id && selectedChatType === 'user' ? 'active' : ''} ${conv.manuallyUnread ? 'manually-unread' : ''} ${conv.unread > 0 ? 'has-unread' : ''}`}
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
                                {/* Unread indicator (red dot) */}
                                {conv.unread > 0 && (
                                  <span className="unread-indicator"></span>
                                )}
                                {/* Online status dot */}
                                {onlineUsers.includes(conv._id) && (
                                  <span className="status-dot online"></span>
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
                                  {conv.lastMessage?.voiceNote?.url ? '🎤 Voice note' : (conv.lastMessage?.content || 'No messages')}
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
                  {!currentUser ? (
                    <div className="loading-messages">Loading messages...</div>
                  ) : (
                    messages.map((msg, index) => {
                      const isSent = msg.sender._id === currentUser._id;
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
                        <div className="message-content">
                          {/* Show sender name and avatar above message bubble */}
                          <div className="message-header">
                            <div className="message-avatar-small">
                              {msg.sender.profilePhoto ? (
                                <img src={getImageUrl(msg.sender.profilePhoto)} alt={msg.sender.username} />
                              ) : (
                                <span>{msg.sender.username?.charAt(0).toUpperCase() || 'U'}</span>
                              )}
                            </div>
                            <div className="message-sender-name">{msg.sender.displayName || msg.sender.username}</div>
                          </div>

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
                              <div
                                className="message-bubble"
                                style={
                                  isSent
                                    ? {
                                        background: getSentMessageColor(currentTheme).background,
                                        color: getSentMessageColor(currentTheme).text
                                      }
                                    : {
                                        background: getUserChatColor(msg.sender._id, currentTheme).background,
                                        color: getUserChatColor(msg.sender._id, currentTheme).text
                                      }
                                }
                              >
                                {msg.content}

                                {/* Voice Note Player */}
                                {msg.voiceNote?.url && (
                                  <AudioPlayer
                                    url={getImageUrl(msg.voiceNote.url)}
                                    duration={msg.voiceNote.duration}
                                  />
                                )}

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

                              <div className="message-meta">
                                <div className="message-time">
                                  {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </div>
                                {msg.edited && <div className="message-edited-indicator">(edited)</div>}
                              </div>

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
                        </div>
                      </div>
                      </React.Fragment>
                    );
                  })
                  )}
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
                  {showContentWarning && (
                    <div className="content-warning-input">
                      <select
                        value={contentWarning}
                        onChange={(e) => setContentWarning(e.target.value)}
                        className="cw-input glossy"
                      >
                        <option value="">Select a content warning...</option>
                        <option value="Mental Health">Mental Health</option>
                        <option value="Violence">Violence</option>
                        <option value="Sexual Content">Sexual Content</option>
                        <option value="Substance Use">Substance Use</option>
                        <option value="Self-Harm">Self-Harm</option>
                        <option value="Death/Grief">Death/Grief</option>
                        <option value="Eating Disorders">Eating Disorders</option>
                        <option value="Abuse">Abuse</option>
                        <option value="Discrimination">Discrimination</option>
                        <option value="Medical Content">Medical Content</option>
                        <option value="Spoilers">Spoilers</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  )}
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
                  {selectedFile && (
                    <div className="file-preview">
                      <div className="file-preview-content">
                        {selectedFile.type.startsWith('image/') ? (
                          <img src={getImageUrl(selectedFile.url)} alt="Preview" className="file-preview-image" />
                        ) : (
                          <div className="file-preview-icon">🎥</div>
                        )}
                        <span className="file-preview-name">{selectedFile.name}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-cancel-reply"
                        onClick={handleRemoveFile}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {selectedGif && (
                    <div className="file-preview">
                      <div className="file-preview-content">
                        <img src={selectedGif} alt="Selected GIF" className="file-preview-image" />
                      </div>
                      <button
                        type="button"
                        className="btn-cancel-reply"
                        onClick={() => setSelectedGif(null)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <div className="chat-input-wrapper">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*,video/*"
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="btn-attachment"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile || selectedGif}
                      title="Attach file"
                    >
                      {uploadingFile ? '⏳' : '📎'}
                    </button>
                    <button
                      type="button"
                      className="btn-gif"
                      onClick={() => setShowGifPicker(!showGifPicker)}
                      disabled={selectedFile}
                      title="Add GIF"
                    >
                      GIF
                    </button>
                    <button
                      type="button"
                      className="btn-voice"
                      onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                      disabled={selectedFile || selectedGif}
                      title="Record voice note"
                    >
                      🎤
                    </button>
                    <button
                      type="button"
                      className={`btn-content-warning ${showContentWarning ? 'active' : ''}`}
                      onClick={() => setShowContentWarning(!showContentWarning)}
                      title="Add content warning"
                    >
                      ⚠️
                    </button>
                    <input
                      type="text"
                      value={message}
                      onChange={handleTyping}
                      placeholder={replyingTo ? "Type your reply..." : (selectedGif || selectedFile ? "Add a caption (optional)..." : "Type a message...")}
                      className="chat-input glossy"
                    />
                    <button type="submit" className="btn-send glossy-gold" disabled={uploadingFile}>
                      Send
                    </button>
                  </div>
                  {showGifPicker && (
                    <GifPicker
                      onGifSelect={(gifUrl) => {
                        setSelectedGif(gifUrl);
                        setSelectedFile(null);
                        setShowGifPicker(false);
                      }}
                      onClose={() => setShowGifPicker(false)}
                    />
                  )}
                  {showVoiceRecorder && (
                    <VoiceRecorder
                      onRecordingComplete={async (audioBlob, duration) => {
                        try {
                          // Upload voice note
                          const formData = new FormData();
                          formData.append('file', audioBlob, 'voice-note.webm');

                          const uploadResponse = await api.post('/upload', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          });

                          // Send message with voice note
                          const voiceNoteData = {
                            url: uploadResponse.data.url,
                            duration: duration
                          };

                          await handleSendMessage(null, voiceNoteData);
                          setShowVoiceRecorder(false);
                        } catch (error) {
                          logger.error('Failed to send voice note:', error);
                          showAlert('Failed to send voice note. Please try again.', 'Voice Note Failed');
                        }
                      }}
                      onCancel={() => setShowVoiceRecorder(false)}
                    />
                  )}
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

        {/* New Group Modal - Hidden for Plan A */}
        {false && showNewGroupModal && (
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

        {/* Custom Modal */}
        <CustomModal
          isOpen={modalState.isOpen}
          onClose={closeModal}
          type={modalState.type}
          title={modalState.title}
          message={modalState.message}
          placeholder={modalState.placeholder}
          confirmText={modalState.confirmText}
          cancelText={modalState.cancelText}
          onConfirm={modalState.onConfirm}
          inputType={modalState.inputType}
          defaultValue={modalState.defaultValue}
        />
      </div>
    </div>
  );
}

export default Messages;
