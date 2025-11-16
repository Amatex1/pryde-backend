// Profile management JavaScript
const API_URL = window.location.origin;
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

let currentUser = null;

// Load current user profile
async function loadProfile() {
  try {
    const response = await fetch(`${API_URL}/api/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load profile');
    }

    currentUser = await response.json();
    displayProfile();
  } catch (error) {
    console.error('Error loading profile:', error);
    document.getElementById('error').textContent = 'Failed to load profile';
  }
}

function displayProfile() {
  document.getElementById('display_name').value = currentUser.display_name;
  document.getElementById('bio').value = currentUser.bio || '';
  
  const avatarPreview = document.getElementById('avatarPreview');
  if (currentUser.avatar_url) {
    avatarPreview.innerHTML = `<img src="${currentUser.avatar_url}" class="profile-avatar" alt="Avatar">`;
  } else {
    avatarPreview.innerHTML = `<div class="avatar-placeholder" style="width: 120px; height: 120px; font-size: 48px; margin: 0 auto;">${currentUser.display_name.charAt(0).toUpperCase()}</div>`;
  }
}

// Handle profile form submission
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const display_name = document.getElementById('display_name').value;
  const bio = document.getElementById('bio').value;
  
  try {
    const response = await fetch(`${API_URL}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ display_name, bio })
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    const updatedUser = await response.json();
    currentUser = updatedUser;
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    document.getElementById('message').textContent = 'Profile updated successfully!';
    setTimeout(() => {
      document.getElementById('message').textContent = '';
    }, 3000);
  } catch (error) {
    console.error('Error updating profile:', error);
    document.getElementById('error').textContent = 'Failed to update profile';
  }
});

// Handle avatar upload
document.getElementById('avatarInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const response = await fetch(`${API_URL}/api/upload-profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload avatar');
    }

    const data = await response.json();
    currentUser.avatar_url = data.avatar_url;
    localStorage.setItem('user', JSON.stringify(data.user));
    displayProfile();
    
    document.getElementById('message').textContent = 'Avatar updated successfully!';
    setTimeout(() => {
      document.getElementById('message').textContent = '';
    }, 3000);
  } catch (error) {
    console.error('Error uploading avatar:', error);
    document.getElementById('error').textContent = 'Failed to upload avatar';
  }
});

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// Load profile on page load
loadProfile();
