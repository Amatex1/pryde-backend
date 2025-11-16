const API_URL = window.location.origin;
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user'));

if (!token || !currentUser) {
  window.location.href = 'login.html';
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// Get other user info from URL
const urlParams = new URLSearchParams(window.location.search);
const otherUserId = urlParams.get('userId');
const otherUserName = urlParams.get('name');
const otherUserAvatar = urlParams.get('avatar');

if (!otherUserId) {
  window.location.href = 'directory.html';
}

// Set header info
document.getElementById('otherUserName').textContent = otherUserName;
document.getElementById('otherUserAvatar').src = otherUserAvatar || 
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#ddd"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="20" fill="#999">' + 
  otherUserName.charAt(0).toUpperCase() + '</text></svg>';

// Initialize Socket.io
const socket = io(API_URL, {
  auth: { token }
});

const messageIds = new Set();

socket.on('connect', () => {
  console.log('Connected to socket server');
  loadMessages();
});

socket.on('chat:message', (message) => {
  displayMessage(message);
  
  // Mark message as read if it's from the other user and window is visible
  if (message.from._id === otherUserId && document.visibilityState === 'visible') {
    markMessageAsRead(message._id);
  }
});

socket.on('message:read', (data) => {
  // Update read ticks for messages
  data.messageIds.forEach(msgId => {
    const msgElement = document.querySelector(`[data-message-id="${msgId}"]`);
    if (msgElement) {
      const readTick = msgElement.querySelector('.read-tick');
      if (readTick) {
        readTick.textContent = '✓✓';
      }
    }
  });
});

socket.on('typing', (data) => {
  // Could show typing indicator here
  console.log('User is typing:', data);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Load existing messages
async function loadMessages() {
  try {
    const response = await fetch(`${API_URL}/api/messages/conversation/${otherUserId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to load messages');
    }

    const data = await response.json();
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    data.messages.forEach(message => {
      displayMessage(message);
    });

    // Mark all messages as read
    const unreadMessageIds = data.messages
      .filter(m => m.from._id === otherUserId && !m.read_by.includes(currentUser.id))
      .map(m => m._id);
    
    if (unreadMessageIds.length > 0) {
      markMessagesAsRead(unreadMessageIds);
    }

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

function displayMessage(message) {
  // Prevent duplicate messages
  if (messageIds.has(message._id)) {
    return;
  }
  messageIds.add(message._id);

  const chatMessages = document.getElementById('chatMessages');
  const isOwn = message.from._id === currentUser.id;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isOwn ? 'own' : ''}`;
  messageDiv.setAttribute('data-message-id', message._id);

  const avatar = isOwn ? currentUser.avatar_url : otherUserAvatar;
  const avatarSrc = avatar || 
    `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#ddd"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#999">${message.from.display_name.charAt(0).toUpperCase()}</text></svg>`;

  let contentHtml = '';
  if (message.content) {
    contentHtml += `<div>${escapeHtml(message.content)}</div>`;
  }
  if (message.image_url) {
    contentHtml += `<img src="${API_URL}${message.image_url}" alt="Image">`;
  }

  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isRead = message.read_by && message.read_by.length > 1;
  const readTick = isOwn ? `<span class="read-tick">${isRead ? '✓✓' : '✓'}</span>` : '';

  messageDiv.innerHTML = `
    <img src="${avatarSrc}" alt="${message.from.display_name}" class="message-avatar">
    <div>
      <div class="message-content">
        ${contentHtml}
      </div>
      <div class="message-time">${time} ${readTick}</div>
    </div>
  `;

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Send message
async function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const content = messageInput.value.trim();

  if (!content) return;

  // Emit via socket
  socket.emit('chat:message', {
    to: otherUserId,
    content
  });

  messageInput.value = '';
}

// Handle image upload
document.getElementById('imageInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`${API_URL}/api/messages/upload-image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();

    // Send message with image
    socket.emit('chat:message', {
      to: otherUserId,
      image_url: data.url
    });

    // Clear input
    e.target.value = '';
  } catch (error) {
    console.error('Error uploading image:', error);
    alert('Failed to upload image');
  }
});

// Mark message as read
function markMessageAsRead(messageId) {
  markMessagesAsRead([messageId]);
}

function markMessagesAsRead(messageIds) {
  if (messageIds.length === 0) return;
  
  socket.emit('message:read', { messageIds });
}

// Handle Enter key
function handleKeyPress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

// Mark messages as read when window becomes visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const unreadMessages = Array.from(document.querySelectorAll('.message:not(.own)'))
      .map(el => el.getAttribute('data-message-id'));
    
    if (unreadMessages.length > 0) {
      markMessagesAsRead(unreadMessages);
    }
  }
});
