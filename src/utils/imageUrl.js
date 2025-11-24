import { API_BASE_URL } from '../config/api';

/**
 * Helper function to get full image URL
 * @param {string} path - The image path (can be relative or absolute)
 * @returns {string|null} - Full image URL or null if no path provided
 */
export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path; // Already a full URL
  return `${API_BASE_URL}${path}`; // Prepend API base URL
};

