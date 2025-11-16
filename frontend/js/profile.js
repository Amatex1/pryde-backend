const API_URL = window.location.origin;
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

let currentAvatarUrl = '';

// Load current user profile
async function loadProfile() {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to load profile');
    }

    const user = await response.json();
    document.getElementById('display_name').value = user.display_name;
    document.getElementById('bio').value = user.bio || '';
    
    currentAvatarUrl = user.avatar_url || '';
    document.getElementById('avatarPreview').src = user.avatar_url || 
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="#ddd"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="60" fill="#999">' + 
      user.display_name.charAt(0).toUpperCase() + '</text></svg>';
  } catch (error) {
    console.error('Error loading profile:', error);
    showError('Failed to load profile');
  }
}

// Handle avatar upload
document.getElementById('avatarInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  try {
    showMessage('Uploading avatar...');
    
    const response = await fetch(`${API_URL}/api/upload-profile`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    currentAvatarUrl = data.url;
    
    // Update preview
    document.getElementById('avatarPreview').src = `${API_URL}${data.url}`;
    
    // Save profile with new avatar
    await saveProfile();
  } catch (error) {
    console.error('Error uploading avatar:', error);
    showError('Failed to upload avatar');
  }
});

// Handle profile form submission
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveProfile();
});

async function saveProfile() {
  const display_name = document.getElementById('display_name').value;
  const bio = document.getElementById('bio').value;

  try {
    const response = await fetch(`${API_URL}/api/users/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ display_name, bio, avatar_url: currentAvatarUrl })
    });

    if (!response.ok) {
      throw new Error('Failed to save profile');
    }

    const user = await response.json();
    
    // Update stored user
    localStorage.setItem('user', JSON.stringify({
      id: user._id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      bio: user.bio
    }));

    showMessage('Profile updated successfully!');
  } catch (error) {
    console.error('Error saving profile:', error);
    showError('Failed to save profile');
  }
}

function showMessage(msg) {
  const messageDiv = document.getElementById('message');
  const errorDiv = document.getElementById('error');
  errorDiv.style.display = 'none';
  messageDiv.textContent = msg;
  messageDiv.style.display = 'block';
  setTimeout(() => messageDiv.style.display = 'none', 3000);
}

function showError(msg) {
  const messageDiv = document.getElementById('message');
  const errorDiv = document.getElementById('error');
  messageDiv.style.display = 'none';
  errorDiv.textContent = msg;
  errorDiv.style.display = 'block';
}

loadProfile();
