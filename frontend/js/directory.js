const API_BASE = window.location.origin;

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/frontend/pages/login.html';
}

// Check authentication
const token = getToken();
if (!token) {
  window.location.href = '/frontend/pages/login.html';
}

const currentUser = getUser();

// Connect to socket
const socket = io(API_BASE, {
  auth: { token }
});

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  if (error.message === 'Authentication error') {
    logout();
  }
});

// Load users
async function loadUsers() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load users');
    }
    
    const users = await response.json();
    displayUsers(users);
  } catch (error) {
    console.error('Error loading users:', error);
    document.getElementById('userList').innerHTML = '<p class="error">Failed to load users</p>';
  }
}

function displayUsers(users) {
  const userList = document.getElementById('userList');
  userList.innerHTML = '';
  
  const filteredUsers = users.filter(user => user._id !== currentUser.id);
  
  if (filteredUsers.length === 0) {
    userList.innerHTML = '<p>No other users found</p>';
    return;
  }
  
  filteredUsers.forEach(user => {
    const userCard = document.createElement('div');
    userCard.className = 'user-card';
    
    const avatar = user.avatar_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Crect fill=%22%23ddd%22 width=%2250%22 height=%2250%22/%3E%3Ctext fill=%22%23999%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2220%22%3E?%3C/text%3E%3C/svg%3E';
    
    userCard.innerHTML = `
      <img src="${avatar}" alt="${user.display_name}" class="avatar">
      <div class="user-info">
        <h3>${user.display_name}</h3>
        <p>${user.bio || 'No bio'}</p>
      </div>
      <button class="btn btn-primary" onclick="openChat('${user._id}', '${user.display_name}')">Chat</button>
    `;
    
    userList.appendChild(userCard);
  });
}

window.openChat = function(userId, displayName) {
  window.location.href = `/frontend/pages/chat.html?userId=${userId}&name=${encodeURIComponent(displayName)}`;
};

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', logout);

// Load users on page load
loadUsers();
