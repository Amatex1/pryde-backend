const API_URL = window.location.origin;

// Check authentication
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = 'login.html';
}

const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

// Get userId from URL
const urlParams = new URLSearchParams(window.location.search);
let currentRecipientId = urlParams.get('userId');

let socket = null;
let messages = [];
let conversations = new Map();

// Initialize Socket.io connection
function initSocket() {
  socket = io(API_URL, {
    auth: {
      token: token
    }
  });

  socket.on('connect', () => {
    console.log('✅ Connected to server');
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
  });

  socket.on('chat:message', (message) => {
    console.log('Received message:', message);
    
    // Add message to list
    messages.push(message);
    
    // Update conversation in sidebar
    updateConversationsList();
    
    // If message is for current conversation, display it
    if (message.from._id === currentRecipientId || message.to._id === currentRecipientId) {
      displayMessage(message);
      scrollToBottom();
      
      // Mark as read if we're the recipient
      if (message.to._id === currentUser.id) {
        markMessagesAsRead([message._id]);
      }
    }
  });

  socket.on('message:read', (data) => {
    console.log('Message read:', data);
    
    // Update read ticks for messages
    data.messageIds.forEach(msgId => {
      const msgElement = document.querySelector(`[data-message-id="${msgId}"]`);
      if (msgElement) {
        const timeElement = msgElement.querySelector('.message-time');
        if (timeElement && !timeElement.querySelector('.read-tick')) {
          timeElement.innerHTML += ' <span class="read-tick">✓✓</span>';
        }
      }
    });
  });

  socket.on('typing', (data) => {
    if (data.from === currentRecipientId) {
      showTypingIndicator(data.isTyping);
    }
  });

  socket.on('user:online', (data) => {
    console.log('User online:', data.userId);
  });

  socket.on('user:offline', (data) => {
    console.log('User offline:', data.userId);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
}

// Load conversation history
async function loadConversation(userId) {
  try {
    const response = await fetch(`${API_URL}/api/messages/conversation/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load conversation');
    }

    messages = data.messages;
    displayMessages();
    scrollToBottom();
    
    // Mark unread messages as read
    const unreadMessageIds = messages
      .filter(msg => msg.to._id === currentUser.id && !msg.read_by.includes(currentUser.id))
      .map(msg => msg._id);
    
    if (unreadMessageIds.length > 0) {
      markMessagesAsRead(unreadMessageIds);
    }

  } catch (error) {
    console.error('Load conversation error:', error);
  }
}

// Load conversations list
async function loadConversationsList() {
  try {
    const response = await fetch(`${API_URL}/api/messages/list`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load conversations');
    }

    displayConversationsList(data.conversations);

  } catch (error) {
    console.error('Load conversations list error:', error);
  }
}

function displayConversationsList(convos) {
  const container = document.getElementById('conversationsList');
  
  if (convos.length === 0) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">No conversations yet</p>';
    return;
  }

  container.innerHTML = convos.map(convo => {
    const otherUser = convo.fromUser._id === currentUser.id ? convo.toUser : convo.fromUser;
    const isActive = otherUser._id === currentRecipientId;
    const preview = convo.content || (convo.image_url ? '📷 Image' : 'No messages yet');
    
    return `
      <div class="conversation-item ${isActive ? 'active' : ''}" onclick="selectConversation('${otherUser._id}')">
        <div class="conversation-name">${escapeHtml(otherUser.display_name)}</div>
        <div class="conversation-preview">${escapeHtml(preview)}</div>
      </div>
    `;
  }).join('');
}

function updateConversationsList() {
  loadConversationsList();
}

function selectConversation(userId) {
  currentRecipientId = userId;
  window.history.pushState({}, '', `?userId=${userId}`);
  loadConversation(userId);
  loadUserInfo(userId);
}

async function loadUserInfo(userId) {
  try {
    const response = await fetch(`${API_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    const user = data.users.find(u => u._id === userId);
    
    if (user) {
      document.getElementById('recipientName').textContent = user.display_name;
    }
  } catch (error) {
    console.error('Load user info error:', error);
  }
}

function displayMessages() {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = messages.map(msg => {
    const isSent = msg.from._id === currentUser.id;
    const isRead = msg.read_by && msg.read_by.length > 1; // More than just sender
    
    return `
      <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${msg._id}">
        <div class="message-avatar" style="${msg.from.avatar_url ? `background-image: url('${API_URL}${msg.from.avatar_url}'); background-size: cover;` : ''}"></div>
        <div>
          <div class="message-content">
            ${msg.content ? `<div>${escapeHtml(msg.content)}</div>` : ''}
            ${msg.image_url ? `<img src="${API_URL}${msg.image_url}" alt="Image" class="message-image">` : ''}
          </div>
          <div class="message-time">
            ${formatTime(msg.created_at)}
            ${isSent && isRead ? '<span class="read-tick">✓✓</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function displayMessage(msg) {
  const container = document.getElementById('messagesContainer');
  const isSent = msg.from._id === currentUser.id;
  const isRead = msg.read_by && msg.read_by.length > 1;
  
  const messageHtml = `
    <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${msg._id}">
      <div class="message-avatar" style="${msg.from.avatar_url ? `background-image: url('${API_URL}${msg.from.avatar_url}'); background-size: cover;` : ''}"></div>
      <div>
        <div class="message-content">
          ${msg.content ? `<div>${escapeHtml(msg.content)}</div>` : ''}
          ${msg.image_url ? `<img src="${API_URL}${msg.image_url}" alt="Image" class="message-image">` : ''}
        </div>
        <div class="message-time">
          ${formatTime(msg.created_at)}
          ${isSent && isRead ? '<span class="read-tick">✓✓</span>' : ''}
        </div>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', messageHtml);
}

function markMessagesAsRead(messageIds) {
  if (socket && messageIds.length > 0) {
    socket.emit('message:read', { messageIds });
  }
}

// Send message
async function sendMessage(content, imageUrl = null) {
  if (!currentRecipientId) {
    alert('Please select a recipient');
    return;
  }

  if (!content && !imageUrl) {
    return;
  }

  socket.emit('chat:message', {
    to: currentRecipientId,
    content: content || null,
    image_url: imageUrl
  });

  // Clear input
  document.getElementById('messageInput').value = '';
}

// Upload image
async function uploadImage(file) {
  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_URL}/api/messages/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    return data.image_url;

  } catch (error) {
    console.error('Upload image error:', error);
    alert('Failed to upload image: ' + error.message);
    return null;
  }
}

// Event handlers
document.getElementById('sendBtn').addEventListener('click', () => {
  const content = document.getElementById('messageInput').value.trim();
  if (content) {
    sendMessage(content);
  }
});

document.getElementById('messageInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const content = e.target.value.trim();
    if (content) {
      sendMessage(content);
    }
  }
});

document.getElementById('attachBtn').addEventListener('click', () => {
  document.getElementById('imageInput').click();
});

document.getElementById('imageInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    const imageUrl = await uploadImage(file);
    if (imageUrl) {
      sendMessage(null, imageUrl);
    }
    e.target.value = ''; // Reset input
  }
});

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) { // Less than 1 minute
    return 'Just now';
  } else if (diff < 3600000) { // Less than 1 hour
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  } else if (diff < 86400000) { // Less than 1 day
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString();
  }
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator(isTyping) {
  // TODO: Implement typing indicator
}

// Initialize
initSocket();
loadConversationsList();

if (currentRecipientId) {
  loadConversation(currentRecipientId);
  loadUserInfo(currentRecipientId);
}
