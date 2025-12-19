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

/**
 * Get CSRF token from cookie
 * The backend sets this cookie automatically on all requests
 */
const getCsrfToken = () => {
  const name = 'XSRF-TOKEN=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(';');

  for (let i = 0; i < cookieArray.length; i++) {
    let cookie = cookieArray[i].trim();
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length, cookie.length);
    }
  }
  return null;
};

// Add auth token and CSRF token to requests
api.interceptors.request.use(
  (config) => {
    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {};
    }

    // Add JWT token for authentication
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token for state-changing requests (POST, PUT, PATCH, DELETE)
    const method = config.method?.toUpperCase();
    if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-XSRF-TOKEN'] = csrfToken;
        logger.debug(`🛡️ CSRF token attached to ${method} ${config.url}:`, csrfToken.substring(0, 20) + '...');
      } else {
        logger.warn(`⚠️ No CSRF token found for ${method} ${config.url}`);
        logger.warn(`📋 Current cookies: ${document.cookie}`);
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 errors (unauthorized) and 403 CSRF errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle CSRF token errors (403)
    if (error.response?.status === 403) {
      const errorMessage = error.response?.data?.message || '';

      // Check if it's a CSRF error
      if (errorMessage.includes('CSRF') || errorMessage.includes('csrf')) {
        logger.error('🛡️ CSRF token error:', errorMessage);
        logger.error('📋 Current cookies:', document.cookie);
        logger.error('📋 Request headers:', originalRequest.headers);

        // If CSRF token is missing or expired, make a GET request to get a new token
        // The backend's setCsrfToken middleware will set a new cookie on any request
        if (!originalRequest._csrfRetry) {
          originalRequest._csrfRetry = true;

          try {
            // Make a lightweight GET request to trigger CSRF token refresh
            logger.debug('🔄 Requesting new CSRF token...');
            await api.get('/posts?limit=1');

            // Wait a moment for the cookie to be set
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check if we now have a CSRF token
            const newCsrfToken = getCsrfToken();
            if (newCsrfToken) {
              logger.debug('✅ New CSRF token obtained, retrying request');
              // Retry the original request with the new CSRF token
              return api(originalRequest);
            } else {
              logger.error('❌ Failed to obtain new CSRF token');
              return Promise.reject(new Error('Security token expired. Please refresh the page and try again.'));
            }
          } catch (refreshError) {
            logger.error('❌ Failed to refresh CSRF token:', refreshError);
            return Promise.reject(new Error('Security token expired. Please refresh the page and try again.'));
          }
        }

        // If retry failed, show user-friendly error
        logger.error('❌ CSRF protection failed after retry. Please refresh the page.');
        return Promise.reject(new Error('Security token expired. Please refresh the page and try again.'));
      }
    }

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
