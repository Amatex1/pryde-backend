import { API_BASE_URL } from "../config/api.js"; // include .js extension
import axios from "axios";
import { getAuthToken, logout, isManualLogout, setAuthToken, getRefreshToken, setRefreshToken, getCurrentUser } from "./auth";
import logger from './logger';
import { disconnectSocket, initializeSocket } from './socket';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true // Enable cookies for refresh token
});

// Track if we're currently refreshing the token
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 errors (unauthorized) - try to refresh token first
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh the token
        logger.debug('🔄 Token expired, refreshing...');

        // Get refresh token from localStorage (for cross-domain setups)
        const refreshToken = getRefreshToken();

        const response = await axios.post(`${API_BASE_URL}/refresh`, {
          refreshToken // Send refresh token in body for cross-domain
        }, {
          withCredentials: true // Also try to send httpOnly cookie if available
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        if (accessToken) {
          logger.debug('✅ Token refreshed successfully');
          setAuthToken(accessToken);

          // Store new refresh token if provided
          if (newRefreshToken) {
            setRefreshToken(newRefreshToken);
          }

          // Reconnect socket with new token
          try {
            const currentUser = getCurrentUser();
            if (currentUser?.id) {
              disconnectSocket();
              initializeSocket(currentUser.id);
            }
          } catch (socketError) {
            logger.error('⚠️ Failed to reconnect socket:', socketError);
          }

          // Update the failed request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;

          // Process queued requests
          processQueue(null, accessToken);

          isRefreshing = false;

          // Retry the original request
          return api(originalRequest);
        }
      } catch (refreshError) {
        logger.error('❌ Token refresh failed:', refreshError.message);
        logger.error('📍 Refresh error response:', refreshError.response?.data);
        logger.error('📍 Refresh error status:', refreshError.response?.status);
        logger.error('📍 Current cookies at failure:', document.cookie);

        processQueue(refreshError, null);
        isRefreshing = false;

        // Check if this is a manual logout or session expiration
        const wasManualLogout = isManualLogout();

        // Token refresh failed - logout
        logger.warn('🔒 Authentication failed - logging out');
        logout();

        // Only redirect if not already on login/register page
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/register') {
          // Only add expired=true if it was NOT a manual logout
          if (wasManualLogout) {
            window.location.href = '/login';
          } else {
            window.location.href = '/login?expired=true';
          }
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
