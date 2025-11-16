const API_BASE = window.location.origin;

function getToken() {
  return localStorage.getItem('token');
}

function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
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

// Load profile
async function loadProfile() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load profile');
    }
    
    const profile = await response.json();
    
    document.getElementById('displayName').value = profile.display_name || '';
    document.getElementById('email').value = profile.email || '';
    document.getElementById('bio').value = profile.bio || '';
    
    if (profile.avatar_url) {
      document.getElementById('avatarPreview').src = profile.avatar_url;
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    document.getElementById('error').textContent = 'Failed to load profile';
  }
}

// Handle profile form
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const displayName = document.getElementById('displayName').value;
  const bio = document.getElementById('bio').value;
  const errorDiv = document.getElementById('error');
  const successDiv = document.getElementById('success');
  
  errorDiv.textContent = '';
  successDiv.textContent = '';
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ display_name: displayName, bio })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      successDiv.textContent = 'Profile updated successfully!';
      
      // Update stored user
      const user = getUser();
      user.display_name = data.display_name;
      user.bio = data.bio;
      saveUser(user);
    } else {
      errorDiv.textContent = data.error || 'Failed to update profile';
    }
  } catch (error) {
    errorDiv.textContent = 'Network error. Please try again.';
  }
});

// Handle avatar upload
document.getElementById('uploadAvatarBtn').addEventListener('click', () => {
  document.getElementById('avatarInput').click();
});

document.getElementById('avatarInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const errorDiv = document.getElementById('error');
  const successDiv = document.getElementById('success');
  
  errorDiv.textContent = '';
  successDiv.textContent = '';
  
  const formData = new FormData();
  formData.append('image', file);
  
  try {
    const response = await fetch(`${API_BASE}/api/upload-profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (response.ok) {
      document.getElementById('avatarPreview').src = data.avatar_url;
      successDiv.textContent = 'Avatar uploaded successfully!';
      
      // Update stored user
      const user = getUser();
      user.avatar_url = data.avatar_url;
      saveUser(user);
    } else {
      errorDiv.textContent = data.error || 'Failed to upload avatar';
    }
  } catch (error) {
    errorDiv.textContent = 'Network error. Please try again.';
  }
});

// Load profile on page load
loadProfile();
