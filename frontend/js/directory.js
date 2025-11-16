const API_URL = window.location.origin;

// Check authentication
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = 'login.html';
}

const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
});

// Load users
async function loadUsers() {
  try {
    const response = await fetch(`${API_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load users');
    }

    displayUsers(data.users);
  } catch (error) {
    console.error('Load users error:', error);
    document.getElementById('usersGrid').innerHTML = 
      `<p style="text-align: center; color: red;">Failed to load users: ${error.message}</p>`;
  }
}

function displayUsers(users) {
  const grid = document.getElementById('usersGrid');
  
  if (users.length === 0) {
    grid.innerHTML = '<p style="text-align: center;">No users found.</p>';
    return;
  }

  grid.innerHTML = users.map(user => `
    <div class="user-card" onclick="openChat('${user._id}')">
      <div class="user-avatar" style="${user.avatar_url ? `background-image: url('${API_URL}${user.avatar_url}'); background-size: cover; background-position: center;` : ''}"></div>
      <div class="user-name">${escapeHtml(user.display_name)}</div>
      ${user.bio ? `<div class="user-bio">${escapeHtml(user.bio)}</div>` : ''}
    </div>
  `).join('');
}

function openChat(userId) {
  window.location.href = `chat.html?userId=${userId}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load users on page load
loadUsers();
