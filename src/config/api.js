// src/config/api.js

// Base URL of backend API (must include /api)
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://pryde-social.onrender.com/api";

// Socket URL uses the server root, NOT /api
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  "https://pryde-social.onrender.com";

// Default export for compatibility
export default {
  API_BASE_URL,
  SOCKET_URL,
};

