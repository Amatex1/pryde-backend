/**
 * Chat Bubble Color Utility
 * Assigns consistent colors to users based on their ID
 */

// Color palette for received messages (other users)
const chatColors = [
  {
    light: '#FFE5E5', // Soft pink
    dark: '#8B4C5C',
    text: '#2B2B2B'
  },
  {
    light: '#E5F3FF', // Soft blue
    dark: '#4C6B8B',
    text: '#2B2B2B'
  },
  {
    light: '#FFF4E5', // Soft orange
    dark: '#8B6B4C',
    text: '#2B2B2B'
  },
  {
    light: '#F0E5FF', // Soft purple
    dark: '#6B4C8B',
    text: '#2B2B2B'
  },
  {
    light: '#E5FFF0', // Soft green
    dark: '#4C8B6B',
    text: '#2B2B2B'
  },
  {
    light: '#FFE5F5', // Soft magenta
    dark: '#8B4C7A',
    text: '#2B2B2B'
  },
  {
    light: '#E5FFFF', // Soft cyan
    dark: '#4C8B8B',
    text: '#2B2B2B'
  },
  {
    light: '#FFF0E5', // Soft peach
    dark: '#8B7A4C',
    text: '#2B2B2B'
  },
  {
    light: '#F5E5FF', // Soft lavender
    dark: '#7A4C8B',
    text: '#2B2B2B'
  },
  {
    light: '#E5FFEB', // Soft mint
    dark: '#4C8B5C',
    text: '#2B2B2B'
  }
];

// Sent message colors (your messages)
export const sentMessageColors = {
  light: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    text: '#FFFFFF'
  },
  dark: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    text: '#FFFFFF'
  }
};

/**
 * Get a consistent color for a user based on their ID
 * @param {string} userId - The user's ID
 * @param {string} theme - Current theme ('light' or 'dark')
 * @returns {object} - Color object with background and text colors
 */
export const getUserChatColor = (userId, theme = 'light') => {
  // Check if Quiet Mode is enabled
  const isQuietMode = document.documentElement.getAttribute('data-quiet-mode') === 'true';

  if (isQuietMode) {
    // Use better contrast colors for Quiet Mode
    if (theme === 'dark') {
      // Dark + Quiet Mode: Use vibrant teal with good contrast
      return {
        background: '#1F4A52', // Darker teal background
        text: '#FFFFFF'
      };
    } else {
      // Light + Quiet Mode: Use soft purple
      return {
        background: '#F3F0FF', // Soft lavender background
        text: '#2D2640'
      };
    }
  }

  if (!userId) {
    console.warn('⚠️ getUserChatColor called with no userId');
    return {
      background: theme === 'dark' ? '#2C3E50' : '#E8F4F8',
      text: theme === 'dark' ? '#E0E0E0' : '#2B2B2B'
    };
  }

  // Convert userId to string to ensure consistent hashing
  const userIdStr = String(userId);

  // Create a simple hash from the userId
  let hash = 0;
  for (let i = 0; i < userIdStr.length; i++) {
    hash = userIdStr.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Get a consistent index from the hash
  const index = Math.abs(hash) % chatColors.length;
  const colorScheme = chatColors[index];

  return {
    background: theme === 'dark' ? colorScheme.dark : colorScheme.light,
    text: theme === 'dark' ? '#E0E0E0' : colorScheme.text
  };
};

/**
 * Get sent message color
 * @param {string} theme - Current theme ('light' or 'dark')
 * @returns {object} - Color object with background and text colors
 */
export const getSentMessageColor = (theme = 'light') => {
  // Check if Quiet Mode is enabled
  const isQuietMode = document.documentElement.getAttribute('data-quiet-mode') === 'true';

  if (isQuietMode) {
    // Use better contrast colors for sent messages in Quiet Mode
    if (theme === 'dark') {
      // Dark + Quiet Mode: Use vibrant cyan
      return {
        background: '#06B6D4', // Vibrant cyan
        text: '#FFFFFF'
      };
    } else {
      // Light + Quiet Mode: Use Pryde Purple
      return {
        background: '#6C5CE7', // Pryde Purple
        text: '#FFFFFF'
      };
    }
  }

  return {
    background: sentMessageColors[theme].background,
    text: sentMessageColors[theme].text
  };
};

