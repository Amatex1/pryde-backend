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

// Load profile
async function loadProfile() {
  try {
    const response = await fetch(`${API_URL}/api/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load profile');
    }

    // Update form
    document.getElementById('email').value = data.user.email;
    document.getElementById('displayName').value = data.user.display_name;
    document.getElementById('bio').value = data.user.bio || '';
    
    // Update avatar
    const avatar = document.getElementById('profileAvatar');
    if (data.user.avatar_url) {
      avatar.src = `${API_URL}${data.user.avatar_url}`;
      avatar.style.display = 'block';
    } else {
      avatar.style.display = 'none';
    }

  } catch (error) {
    console.error('Load profile error:', error);
    showError('Failed to load profile: ' + error.message);
  }
}

// Update profile
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  hideMessages();
  
  const display_name = document.getElementById('displayName').value;
  const bio = document.getElementById('bio').value;
  
  try {
    const response = await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ display_name, bio })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Update failed');
    }

    // Update localStorage
    localStorage.setItem('user', JSON.stringify(data.user));
    
    showSuccess('Profile updated successfully!');

  } catch (error) {
    console.error('Update profile error:', error);
    showError(error.message);
  }
});

// Upload avatar
document.getElementById('avatarInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  hideMessages();

  try {
    const formData = new FormData();
    formData.append('profile', file);

    const response = await fetch(`${API_URL}/api/upload-profile`, {
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

    // Update avatar display
    const avatar = document.getElementById('profileAvatar');
    avatar.src = `${API_URL}${data.avatar_url}?t=${Date.now()}`;
    avatar.style.display = 'block';

    // Update localStorage
    const user = JSON.parse(localStorage.getItem('user'));
    user.avatar_url = data.avatar_url;
    localStorage.setItem('user', JSON.stringify(user));

    showSuccess('Avatar updated successfully!');

  } catch (error) {
    console.error('Upload avatar error:', error);
    showError('Failed to upload avatar: ' + error.message);
  }

  e.target.value = ''; // Reset input
});

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

function showSuccess(message) {
  const successDiv = document.getElementById('successMessage');
  successDiv.textContent = message;
  successDiv.style.display = 'block';
  
  setTimeout(() => {
    successDiv.style.display = 'none';
  }, 3000);
}

function hideMessages() {
  document.getElementById('errorMessage').style.display = 'none';
  document.getElementById('successMessage').style.display = 'none';
}

// Load profile on page load
loadProfile();
