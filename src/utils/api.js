import { API_BASE_URL } from "../config/api.js"; // include .js extension
import axios from "axios";
import { getAuthToken, logout, isManualLogout } from "./auth";
import logger from './logger';

const api = axios.create({
  baseURL: API_BASE_URL
});

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

// Handle 401 errors (unauthorized) - auto logout and redirect
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if this is a manual logout or session expiration
      const wasManualLogout = isManualLogout();

      // Token is invalid or expired
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
    }
    return Promise.reject(error);
  }
);

export default api;
