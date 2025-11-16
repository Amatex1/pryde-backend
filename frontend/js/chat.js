// Chat JavaScript with Socket.io, image uploads, and read receipts
const API_URL = window.location.origin;
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
let socket = null;
let currentChatUserId = null;
let messages = [];
let typingTimeout = null;

// Initialize Socket.io connection
function initSocket() {
  socket = io(API_URL, {
    auth: {
      token: token
    }
  });

  socket.on('connect', () => {
    console.log('✅ Connected to chat server');
    loadConversations();
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from chat server');
  });

  // Handle incoming messages
  socket.on('chat:message', (message) => {
    if (currentChatUserId && 
        (message.from._id === currentChatUserId || message.to._id === currentChatUserId)) {
      messages.push(message);
      displayMessages();
      scrollToBottom();
      
      // Mark as read if we're on the chat and page is visible
      if (document.visibilityState === 'visible' && message.from._id === currentChatUserId) {
        markMessagesAsRead([message._id]);
      }
    }
  });

  // Handle new message notifications (when not in the specific chat)
  socket.on('new:message', (message) => {
    loadConversations(); // Refresh conversation list
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    if (data.from === currentChatUserId) {
      const indicator = document.getElementById('typingIndicator');
      if (data.isTyping) {
        indicator.textContent = 'typing...';
      } else {
        indicator.textContent = '';
      }
    }
  });

  // Handle message read receipts
  socket.on('message:read', (data) => {
    const { messageIds, readBy } = data;
    // Update read status in UI
    messageIds.forEach(msgId => {
      const message = messages.find(m => m._id === msgId);
      if (message && !message.read_by.includes(readBy)) {
        message.read_by.push(readBy);
      }
    });
    displayMessages();
  });

  // Handle user online/offline status
  socket.on('user:online', (data) => {
    console.log('User online:', data.userId);
  });

  socket.on('user:offline', (data) => {
    console.log('User offline:', data.userId);
  });
}

// Load conversations list
async function loadConversations() {
  try {
    const response = await fetch(`${API_URL}/api/messages/list`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load conversations');
    }

    const data = await response.json();
    displayConversations(data.conversations);
  } catch (error) {
    console.error('Error loading conversations:', error);
  }
}

function displayConversations(conversations) {
  const list = document.getElementById('conversationsList');
  list.innerHTML = '<h3>Conversations</h3>';

  if (conversations.length === 0) {
    list.innerHTML += '<p>No conversations yet. Visit <a href="directory.html">Directory</a> to start chatting!</p>';
    return;
  }

  conversations.forEach(conv => {
    if (!conv.user) return;

    const item = document.createElement('div');
    item.className = 'user-item';
    if (currentChatUserId === conv.userId) {
      item.classList.add('active');
    }

    const avatarHtml = conv.user.avatar_url
      ? `<img src="${conv.user.avatar_url}" class="avatar" alt="${conv.user.display_name}">`
      : `<div class="avatar-placeholder">${conv.user.display_name.charAt(0).toUpperCase()}</div>`;

    const lastMsg = conv.lastMessage.content || (conv.lastMessage.image_url ? '📷 Image' : '');
    
    item.innerHTML = `
      ${avatarHtml}
      <div>
        <strong>${conv.user.display_name}</strong>
        <div style="font-size: 12px; color: #999;">${lastMsg.substring(0, 30)}...</div>
      </div>
    `;

    item.onclick = () => openChat(conv.userId);
    list.appendChild(item);
  });
}

// Open chat with a specific user
async function openChat(userId) {
  currentChatUserId = userId;
  
  // Leave previous chat room
  if (socket && currentChatUserId) {
    socket.emit('leave:chat', { withUserId: currentChatUserId });
  }

  // Join new chat room
  socket.emit('join:chat', { withUserId: userId });

  // Load user info
  try {
    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load user');
    }

    const user = await response.json();
    displayChatHeader(user);
  } catch (error) {
    console.error('Error loading user:', error);
  }

  // Load conversation messages
  await loadMessages(userId);
  
  // Refresh conversations list
  loadConversations();
}

function displayChatHeader(user) {
  const header = document.getElementById('chatHeader');
  const avatarHtml = user.avatar_url
    ? `<img src="${user.avatar_url}" class="avatar" alt="${user.display_name}">`
    : `<div class="avatar-placeholder">${user.display_name.charAt(0).toUpperCase()}</div>`;

  header.innerHTML = `
    ${avatarHtml}
    <div>
      <strong>${user.display_name}</strong>
      <div style="font-size: 12px; color: #999;">${user.bio || ''}</div>
    </div>
  `;
}

// Load messages for current conversation
async function loadMessages(userId) {
  try {
    const response = await fetch(`${API_URL}/api/messages/conversation/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load messages');
    }

    const data = await response.json();
    messages = data.messages;
    displayMessages();
    scrollToBottom();

    // Mark unread messages as read
    const unreadMessageIds = messages
      .filter(m => m.from._id === userId && !m.read_by.includes(currentUser.id))
      .map(m => m._id);
    
    if (unreadMessageIds.length > 0) {
      markMessagesAsRead(unreadMessageIds);
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

function displayMessages() {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = '';

  messages.forEach(msg => {
    const messageDiv = document.createElement('div');
    const isSent = msg.from._id === currentUser.id;
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;

    const avatarHtml = msg.from.avatar_url
      ? `<img src="${msg.from.avatar_url}" class="avatar" alt="${msg.from.display_name}">`
      : `<div class="avatar-placeholder">${msg.from.display_name.charAt(0).toUpperCase()}</div>`;

    let contentHtml = '';
    if (msg.image_url) {
      contentHtml = `<img src="${msg.image_url}" class="message-image" alt="Image message">`;
    }
    if (msg.content) {
      contentHtml += `<p>${escapeHtml(msg.content)}</p>`;
    }

    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Show read receipt for sent messages
    let readReceipt = '';
    if (isSent) {
      const isRead = msg.read_by && msg.read_by.length > 1; // More than just sender
      readReceipt = `<div class="read-receipt">${isRead ? '✓✓' : '✓'}</div>`;
    }

    messageDiv.innerHTML = `
      ${avatarHtml}
      <div class="message-content">
        ${contentHtml}
        <div class="message-time">${time}</div>
        ${readReceipt}
      </div>
    `;

    container.appendChild(messageDiv);
  });
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  container.scrollTop = container.scrollHeight;
}

// Handle message form submission
document.getElementById('messageForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentChatUserId) {
    alert('Please select a user to chat with');
    return;
  }

  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  const imageInput = document.getElementById('imageInput');
  const imageFile = imageInput.files[0];

  let image_url = '';

  // Upload image if present
  if (imageFile) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await fetch(`${API_URL}/api/messages/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      image_url = data.imageUrl;
      imageInput.value = ''; // Clear file input
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
      return;
    }
  }

  // Send message via socket
  if (content || image_url) {
    socket.emit('chat:message', {
      to: currentChatUserId,
      content,
      image_url
    });

    input.value = '';
  }
});

// Handle typing indicator
document.getElementById('messageInput').addEventListener('input', (e) => {
  if (!currentChatUserId) return;

  // Clear existing timeout
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }

  // Send typing indicator
  socket.emit('typing', { to: currentChatUserId, isTyping: true });

  // Stop typing after 2 seconds of no input
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { to: currentChatUserId, isTyping: false });
  }, 2000);
});

// Mark messages as read
function markMessagesAsRead(messageIds) {
  if (!messageIds || messageIds.length === 0) return;

  socket.emit('message:read', {
    messageIds,
    withUserId: currentChatUserId
  });
}

// Mark messages as read when page becomes visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentChatUserId) {
    const unreadMessageIds = messages
      .filter(m => m.from._id === currentChatUserId && !m.read_by.includes(currentUser.id))
      .map(m => m._id);
    
    if (unreadMessageIds.length > 0) {
      markMessagesAsRead(unreadMessageIds);
    }
  }
});

function logout() {
  if (socket) {
    socket.disconnect();
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Check if there's a userId in URL (from directory)
const urlParams = new URLSearchParams(window.location.search);
const userIdFromUrl = urlParams.get('userId');

// Initialize
initSocket();

if (userIdFromUrl) {
  // Wait a bit for socket to connect
  setTimeout(() => {
    openChat(userIdFromUrl);
  }, 500);
}
