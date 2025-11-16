// Authentication handling for signup and login pages

const API_BASE = window.location.origin;

// Check if user is already logged in
const token = localStorage.getItem('token');
if (token && (window.location.pathname.includes('signup.html') || window.location.pathname.includes('login.html'))) {
  window.location.href = 'directory.html';
}

// Signup form handler
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = '';
    
    const formData = {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
      display_name: document.getElementById('display_name').value
    };
    
    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        messageDiv.textContent = 'Account created! Redirecting...';
        messageDiv.className = 'message success';
        setTimeout(() => {
          window.location.href = 'directory.html';
        }, 1000);
      } else {
        messageDiv.textContent = data.error || 'Signup failed';
        messageDiv.className = 'message error';
      }
    } catch (error) {
      console.error('Signup error:', error);
      messageDiv.textContent = 'Network error. Please try again.';
      messageDiv.className = 'message error';
    }
  });
}

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = '';
    
    const formData = {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    };
    
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        messageDiv.textContent = 'Login successful! Redirecting...';
        messageDiv.className = 'message success';
        setTimeout(() => {
          window.location.href = 'directory.html';
        }, 1000);
      } else {
        messageDiv.textContent = data.error || 'Login failed';
        messageDiv.className = 'message error';
      }
    } catch (error) {
      console.error('Login error:', error);
      messageDiv.textContent = 'Network error. Please try again.';
      messageDiv.className = 'message error';
    }
  });
}
