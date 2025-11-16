// Chat page with Socket.IO, image uploads, and read receipts

const API_BASE = window.location.origin;

// Check authentication
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) {
  window.location.href = 'login.html';
}

// Get chat user from URL
const urlParams = new URLSearchParams(window.location.search);
const chatUserId = urlParams.get('userId');

// DOM elements
const messagesContainer = document.getElementById('messagesContainer');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const imageInput = document.getElementById('imageInput');
const imageBtn = document.getElementById('imageBtn');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImageBtn');
const typingIndicator = document.getElementById('typingIndicator');
const chatUserName = document.getElementById('chatUserName');
const chatAvatar = document.getElementById('chatAvatar');
const onlineStatus = document.getElementById('onlineStatus');

let socket = null;
let selectedImage = null;
let typingTimeout = null;
let onlineUsers = new Set();

// Initialize Socket.IO connection
function initSocket() {
  socket = io(API_BASE, {
    auth: { token }
  });

  socket.on('connect', () => {
    console.log('✅ Connected to socket server');
    if (chatUserId) {
      socket.emit('join:chat', { chatUserId });
      loadMessages(chatUserId);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from socket server');
  });

  // Handle incoming messages
  socket.on('chat:message', (message) => {
    displayMessage(message);
    
    // Auto-mark as read if the message is in current conversation and page is visible
    if (message.from._id === chatUserId && document.visibilityState === 'visible') {
      socket.emit('message:read', { messageId: message._id });
    }
  });

  // Handle typing indicator
  socket.on('typing', ({ from, isTyping }) => {
    if (from === chatUserId) {
      typingIndicator.style.display = isTyping ? 'block' : 'none';
    }
  });

  // Handle message read receipts
  socket.on('message:read', ({ messageId, readBy }) => {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl && readBy !== currentUser.id) {
      const statusEl = messageEl.querySelector('.message-status');
      if (statusEl) {
        statusEl.textContent = '✓✓';
        statusEl.classList.add('read');
      }
    }
  });

  // Handle online/offline status
  socket.on('user:online', ({ userId }) => {
    onlineUsers.add(userId);
    updateOnlineStatus();
  });

  socket.on('user:offline', ({ userId }) => {
    onlineUsers.delete(userId);
    updateOnlineStatus();
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
}

// Update online status indicator
function updateOnlineStatus() {
  if (chatUserId && onlineUsers.has(chatUserId)) {
    onlineStatus.textContent = 'Online';
    onlineStatus.className = 'online-status online';
  } else {
    onlineStatus.textContent = '';
    onlineStatus.className = 'online-status';
  }
}

// Load messages for a conversation
async function loadMessages(userId) {
  try {
    const response = await fetch(`${API_BASE}/api/messages/conversation/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load messages');
    }

    const data = await response.json();
    messagesContainer.innerHTML = '';

    if (data.messages.length === 0) {
      messagesContainer.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
    } else {
      data.messages.forEach(message => displayMessage(message));
      
      // Mark all unread messages as read
      data.messages.forEach(message => {
        if (message.from._id === userId && !message.read_by.includes(currentUser.id)) {
          socket.emit('message:read', { messageId: message._id });
        }
      });
    }

    scrollToBottom();
  } catch (error) {
    console.error('Error loading messages:', error);
    messagesContainer.innerHTML = '<div class="error">Failed to load messages</div>';
  }
}

// Display a message in the chat
function displayMessage(message) {
  const isOwnMessage = message.from._id === currentUser.id;
  const messageEl = document.createElement('div');
  messageEl.className = `message ${isOwnMessage ? 'own-message' : 'other-message'}`;
  messageEl.setAttribute('data-message-id', message._id);

  const avatar = message.from.avatar_url
    ? `<img src="${message.from.avatar_url}" alt="${message.from.display_name}" class="message-avatar">`
    : `<div class="message-avatar">${message.from.display_name.charAt(0).toUpperCase()}</div>`;

  let content = '';
  
  // Display image if present
  if (message.image_url) {
    content += `<img src="${message.image_url}" alt="Attached image" class="message-image">`;
  }
  
  // Display text content if present
  if (message.content) {
    content += `<p>${escapeHtml(message.content)}</p>`;
  }

  const timestamp = new Date(message.created_at).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Show read status for own messages
  let statusHtml = '';
  if (isOwnMessage) {
    const isRead = message.read_by && message.read_by.length > 1; // More than just sender
    statusHtml = `<span class="message-status ${isRead ? 'read' : ''}">${isRead ? '✓✓' : '✓'}</span>`;
  }

  messageEl.innerHTML = `
    ${!isOwnMessage ? avatar : ''}
    <div class="message-content">
      ${!isOwnMessage ? `<span class="message-sender">${message.from.display_name}</span>` : ''}
      ${content}
      <span class="message-time">${timestamp} ${statusHtml}</span>
    </div>
    ${isOwnMessage ? avatar : ''}
  `;

  messagesContainer.appendChild(messageEl);
  scrollToBottom();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Scroll to bottom of messages
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle image selection
imageBtn.addEventListener('click', () => {
  imageInput.click();
});

imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedImage = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      imagePreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }
});

removeImageBtn.addEventListener('click', () => {
  selectedImage = null;
  imageInput.value = '';
  imagePreview.style.display = 'none';
});

// Handle message sending
messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const content = messageInput.value.trim();
  
  if (!content && !selectedImage) {
    return;
  }

  if (!chatUserId) {
    alert('Please select a user to chat with');
    return;
  }

  try {
    let image_url = '';

    // Upload image if selected
    if (selectedImage) {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const uploadResponse = await fetch(`${API_BASE}/api/messages/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      const uploadData = await uploadResponse.json();
      image_url = uploadData.imageUrl;
    }

    // Send message via socket
    socket.emit('chat:message', {
      to: chatUserId,
      content,
      image_url
    });

    // Clear form
    messageInput.value = '';
    selectedImage = null;
    imageInput.value = '';
    imagePreview.style.display = 'none';
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message');
  }
});

// Handle typing indicator
let isTyping = false;
messageInput.addEventListener('input', () => {
  if (!isTyping && chatUserId) {
    isTyping = true;
    socket.emit('typing', { to: chatUserId, isTyping: true });
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    if (chatUserId) {
      socket.emit('typing', { to: chatUserId, isTyping: false });
    }
  }, 1000);
});

// Load chat user info
async function loadChatUserInfo() {
  if (!chatUserId) return;

  try {
    const response = await fetch(`${API_BASE}/api/users/${chatUserId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load user info');
    }

    const data = await response.json();
    const user = data.user;

    chatUserName.textContent = user.display_name || 'Anonymous';
    
    if (user.avatar_url) {
      chatAvatar.innerHTML = `<img src="${user.avatar_url}" alt="${user.display_name}">`;
    } else {
      chatAvatar.textContent = user.display_name.charAt(0).toUpperCase();
    }
  } catch (error) {
    console.error('Error loading user info:', error);
  }
}

// Handle page visibility for read receipts
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && chatUserId) {
    // Mark all visible messages as read
    const messages = document.querySelectorAll('.message.other-message');
    messages.forEach(messageEl => {
      const messageId = messageEl.getAttribute('data-message-id');
      if (messageId) {
        socket.emit('message:read', { messageId });
      }
    });
  }
});

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  if (socket) {
    socket.disconnect();
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
});

// Initialize
if (chatUserId) {
  loadChatUserInfo();
}
initSocket();
