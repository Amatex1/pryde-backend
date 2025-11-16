// Directory page - list all users

const API_BASE = window.location.origin;

// Check authentication
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = 'login.html';
}

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
});

// Load users
async function loadUsers() {
  try {
    const response = await fetch(`${API_BASE}/api/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    
    const data = await response.json();
    const usersList = document.getElementById('usersList');
    
    if (data.users.length === 0) {
      usersList.innerHTML = '<div class="empty-state">No users found</div>';
      return;
    }
    
    usersList.innerHTML = '';
    
    data.users.forEach(user => {
      const userCard = document.createElement('div');
      userCard.className = 'user-card';
      
      const avatar = user.avatar_url 
        ? `<img src="${user.avatar_url}" alt="${user.display_name}" class="avatar">`
        : `<div class="avatar">${user.display_name.charAt(0).toUpperCase()}</div>`;
      
      userCard.innerHTML = `
        ${avatar}
        <div class="user-info">
          <h3>${user.display_name || 'Anonymous'}</h3>
          <p>${user.bio || 'No bio'}</p>
        </div>
        <a href="chat.html?userId=${user._id}" class="btn-primary btn-sm">Chat</a>
      `;
      
      usersList.appendChild(userCard);
    });
  } catch (error) {
    console.error('Error loading users:', error);
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '<div class="error">Failed to load users</div>';
  }
}

loadUsers();
