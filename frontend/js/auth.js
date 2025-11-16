// Auth utilities
const API_BASE = window.location.origin;

function getToken() {
  return localStorage.getItem('token');
}

function saveToken(token) {
  localStorage.setItem('token', token);
}

function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
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

function checkAuth() {
  if (!getToken()) {
    window.location.href = '/frontend/pages/login.html';
  }
}

// Handle signup form
if (document.getElementById('signupForm')) {
  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const displayName = document.getElementById('displayName').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorDiv = document.getElementById('error');
    
    errorDiv.textContent = '';
    
    if (password !== confirmPassword) {
      errorDiv.textContent = 'Passwords do not match';
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, display_name: displayName, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        saveToken(data.token);
        saveUser(data.user);
        window.location.href = '/frontend/pages/directory.html';
      } else {
        errorDiv.textContent = data.error || 'Signup failed';
      }
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
    }
  });
}

// Handle login form
if (document.getElementById('loginForm')) {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');
    
    errorDiv.textContent = '';
    
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        saveToken(data.token);
        saveUser(data.user);
        window.location.href = '/frontend/pages/directory.html';
      } else {
        errorDiv.textContent = data.error || 'Login failed';
      }
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
    }
  });
}
