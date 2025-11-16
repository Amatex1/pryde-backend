const API_BASE = window.location.origin;

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

// Check authentication
const token = getToken();
if (!token) {
  window.location.href = '/frontend/pages/login.html';
}

const currentUser = getUser();

// Get chat parameters
const urlParams = new URLSearchParams(window.location.search);
const otherUserId = urlParams.get('userId');
const otherUserName = urlParams.get('name');

if (!otherUserId) {
  window.location.href = '/frontend/pages/directory.html';
}

document.getElementById('chatTitle').textContent = `Chat with ${otherUserName}`;

// Connect to socket
const socket = io(API_BASE, {
  auth: { token }
});

let selectedImageFile = null;
let uploadedImageUrl = null;

// Load messages
async function loadMessages() {
  try {
    const response = await fetch(`${API_BASE}/api/messages/conversation/${otherUserId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load messages');
    }
    
    const messages = await response.json();
    displayMessages(messages);
    scrollToBottom();
    
    // Mark messages as read
    markMessagesAsRead();
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

function displayMessages(messages) {
  const messagesDiv = document.getElementById('messages');
  messagesDiv.innerHTML = '';
  
  messages.forEach(msg => {
    appendMessage(msg);
  });
}

function appendMessage(msg) {
  const messagesDiv = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  
  const isOwn = msg.from._id === currentUser.id || msg.from === currentUser.id;
  messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
  
  let content = '';
  if (msg.image_url) {
    content += `<img src="${msg.image_url}" alt="Image" class="message-image">`;
  }
  if (msg.content) {
    content += `<p>${escapeHtml(msg.content)}</p>`;
  }
  
  const readStatus = msg.read_by && msg.read_by.length > 1 ? '✓✓' : '✓';
  const readClass = msg.read_by && msg.read_by.length > 1 ? 'read' : '';
  
  messageDiv.innerHTML = `
    ${content}
    <span class="message-time">${formatTime(msg.created_at)} ${isOwn ? `<span class="read-status ${readClass}">${readStatus}</span>` : ''}</span>
  `;
  
  messagesDiv.appendChild(messageDiv);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  const messagesDiv = document.getElementById('messages');
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Mark messages as read
function markMessagesAsRead() {
  const messagesDiv = document.getElementById('messages');
  const messageElements = messagesDiv.querySelectorAll('.message.other');
  const messageIds = [];
  
  // Get unread message IDs (this is simplified - in production, track actual read status)
  socket.emit('message:read', {
    messageIds,
    otherUserId
  });
}

// Image upload handling
document.getElementById('imageBtn').addEventListener('click', () => {
  document.getElementById('imageInput').click();
});

document.getElementById('imageInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  selectedImageFile = file;
  
  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('previewImage').src = e.target.result;
    document.getElementById('imagePreview').style.display = 'block';
  };
  reader.readAsDataURL(file);
});

document.getElementById('removeImage').addEventListener('click', () => {
  selectedImageFile = null;
  uploadedImageUrl = null;
  document.getElementById('imageInput').value = '';
  document.getElementById('imagePreview').style.display = 'none';
});

// Send message
document.getElementById('messageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const messageInput = document.getElementById('messageInput');
  const content = messageInput.value.trim();
  
  if (!content && !selectedImageFile) return;
  
  try {
    // Upload image if selected
    if (selectedImageFile) {
      const formData = new FormData();
      formData.append('image', selectedImageFile);
      
      const response = await fetch(`${API_BASE}/api/messages/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await response.json();
      if (response.ok) {
        uploadedImageUrl = data.image_url;
      } else {
        console.error('Image upload failed:', data.error);
        return;
      }
    }
    
    // Send message via socket
    socket.emit('chat:message', {
      to: otherUserId,
      content: content || null,
      image_url: uploadedImageUrl
    });
    
    // Clear inputs
    messageInput.value = '';
    selectedImageFile = null;
    uploadedImageUrl = null;
    document.getElementById('imageInput').value = '';
    document.getElementById('imagePreview').style.display = 'none';
  } catch (error) {
    console.error('Error sending message:', error);
  }
});

// Socket event handlers
socket.on('chat:message', (message) => {
  appendMessage(message);
  scrollToBottom();
  
  // Mark as read if from other user
  if (message.from._id === otherUserId || message.from === otherUserId) {
    setTimeout(() => markMessagesAsRead(), 500);
  }
});

socket.on('message:read', (data) => {
  // Update read receipts in UI
  const messageElements = document.querySelectorAll('.message.own .read-status');
  messageElements.forEach(el => {
    el.textContent = '✓✓';
    el.classList.add('read');
  });
});

socket.on('typing', (data) => {
  if (data.from === otherUserId) {
    const indicator = document.getElementById('typingIndicator');
    indicator.textContent = data.isTyping ? `${otherUserName} is typing...` : '';
  }
});

// Typing indicator
let typingTimeout;
document.getElementById('messageInput').addEventListener('input', () => {
  socket.emit('typing', { to: otherUserId, isTyping: true });
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { to: otherUserId, isTyping: false });
  }, 1000);
});

// Load messages on page load
loadMessages();
