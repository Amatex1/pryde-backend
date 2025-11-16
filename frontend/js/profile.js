// Profile page - view and update user profile

const API_BASE = window.location.origin;

// Check authentication
const token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');

if (!token) {
  window.location.href = 'login.html';
}

// DOM elements
const avatarPreview = document.getElementById('avatarPreview');
const avatarInput = document.getElementById('avatarInput');
const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
const profileForm = document.getElementById('profileForm');
const messageDiv = document.getElementById('message');

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
});

// Load current user profile
async function loadProfile() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load profile');
    }

    const data = await response.json();
    const user = data.user;

    // Update form fields
    document.getElementById('display_name').value = user.display_name || '';
    document.getElementById('bio').value = user.bio || '';
    document.getElementById('email').value = user.email || '';

    // Update avatar preview
    if (user.avatar_url) {
      avatarPreview.src = user.avatar_url;
    } else {
      avatarPreview.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="%23ddd"/><text x="50%" y="50%" font-size="60" text-anchor="middle" dy=".3em" fill="%23999">' + (user.display_name ? user.display_name.charAt(0).toUpperCase() : '?') + '</text></svg>';
    }

    currentUser = user;
  } catch (error) {
    console.error('Error loading profile:', error);
    messageDiv.textContent = 'Failed to load profile';
    messageDiv.className = 'message error';
  }
}

// Handle avatar upload button
uploadAvatarBtn.addEventListener('click', () => {
  avatarInput.click();
});

// Handle avatar file selection
avatarInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    avatarPreview.src = e.target.result;
  };
  reader.readAsDataURL(file);

  // Upload to server
  try {
    messageDiv.textContent = 'Uploading avatar...';
    messageDiv.className = 'message';

    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE}/api/upload-profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();

    if (data.success) {
      currentUser.avatar_url = data.imageUrl;
      localStorage.setItem('user', JSON.stringify(data.user));
      messageDiv.textContent = 'Avatar updated successfully!';
      messageDiv.className = 'message success';
    } else {
      throw new Error(data.error || 'Upload failed');
    }
  } catch (error) {
    console.error('Error uploading avatar:', error);
    messageDiv.textContent = 'Failed to upload avatar';
    messageDiv.className = 'message error';
  }
});

// Handle profile form submission
profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  messageDiv.textContent = '';

  const formData = {
    display_name: document.getElementById('display_name').value,
    bio: document.getElementById('bio').value
  };

  try {
    const response = await fetch(`${API_BASE}/api/users/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      throw new Error('Update failed');
    }

    const data = await response.json();

    if (data.success) {
      // Update localStorage
      currentUser.display_name = data.user.display_name;
      currentUser.bio = data.user.bio;
      localStorage.setItem('user', JSON.stringify(currentUser));

      messageDiv.textContent = 'Profile updated successfully!';
      messageDiv.className = 'message success';
    } else {
      throw new Error(data.error || 'Update failed');
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    messageDiv.textContent = 'Failed to update profile';
    messageDiv.className = 'message error';
  }
});

// Load profile on page load
loadProfile();
