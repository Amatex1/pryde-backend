export const setAuthToken = (token) => {
  if (token) {
    console.log('🔑 Setting access token (first 20 chars):', token.substring(0, 20) + '...');
    console.log('⏰ Token set at:', new Date().toISOString());
    localStorage.setItem('token', token);
    localStorage.setItem('tokenSetTime', Date.now().toString());
  } else {
    console.log('🗑️ Removing access token');
    localStorage.removeItem('token');
    localStorage.removeItem('tokenSetTime');
  }
};

export const getAuthToken = () => {
  const token = localStorage.getItem('token');
  const tokenSetTime = localStorage.getItem('tokenSetTime');

  if (token && tokenSetTime) {
    const ageMinutes = (Date.now() - parseInt(tokenSetTime)) / 1000 / 60;
    console.log(`🔍 Getting access token (age: ${ageMinutes.toFixed(1)} minutes)`);

    if (ageMinutes > 15) {
      console.warn(`⚠️ Access token is ${ageMinutes.toFixed(1)} minutes old (expired at 15 min)`);
    }
  }

  return token;
};

export const setCurrentUser = (user) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
};

export const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    if (!user) return null;

    const parsedUser = JSON.parse(user);

    // Validate that the parsed user is an object with expected properties
    if (!parsedUser || typeof parsedUser !== 'object') {
      console.warn('Invalid user data in localStorage, clearing...');
      localStorage.removeItem('user');
      return null;
    }

    return parsedUser;
  } catch (error) {
    console.error('Error parsing user from localStorage:', error);
    // Clear corrupted data
    localStorage.removeItem('user');
    return null;
  }
};

export const logout = () => {
  // Set flag to indicate manual logout (not session expiration)
  sessionStorage.setItem('manualLogout', 'true');
  localStorage.removeItem('token');
  localStorage.removeItem('user');

  // Immediately redirect to login to prevent flash of protected content
  window.location.href = '/login';
};

export const isManualLogout = () => {
  return sessionStorage.getItem('manualLogout') === 'true';
};

export const clearManualLogoutFlag = () => {
  sessionStorage.removeItem('manualLogout');
};

export const isAuthenticated = () => {
  return !!getAuthToken();
};
