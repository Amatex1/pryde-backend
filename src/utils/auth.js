export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

export const getAuthToken = () => {
  return localStorage.getItem('token');
};

export const setCurrentUser = (user) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('user');
  }
};

export const getCurrentUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const logout = () => {
  // Set flag to indicate manual logout (not session expiration)
  sessionStorage.setItem('manualLogout', 'true');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
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
