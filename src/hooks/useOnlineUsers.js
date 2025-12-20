import { useState, useEffect } from 'react';
import { onUserOnline, onUserOffline, onOnlineUsers, requestOnlineUsers } from '../utils/socket';
import { setupSocketListeners } from '../utils/socketHelpers';
import logger from '../utils/logger';

/**
 * Custom hook for managing online user presence.
 * Listens to socket events for user online/offline status and maintains
 * a list of currently online user IDs.
 * 
 * Features:
 * - Single source of truth for online users across the app
 * - Automatic cleanup on unmount
 * - Handles socket reconnection
 * - Prevents duplicate listeners
 * - No polling required
 * 
 * @returns {Object} Object containing:
 *   - onlineUsers: Array of online user IDs
 *   - isUserOnline: Function to check if a specific user is online
 * 
 * @example
 * function MyComponent() {
 *   const { onlineUsers, isUserOnline } = useOnlineUsers();
 *   
 *   return (
 *     <div>
 *       {isUserOnline(userId) ? 'Online' : 'Offline'}
 *     </div>
 *   );
 * }
 */
export function useOnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    logger.debug('🔌 useOnlineUsers: Setting up online presence listeners');
    
    const cleanupFunctions = [];

    const setupListeners = (socket) => {
      // Listen for initial online users list
      const cleanupOnlineUsers = onOnlineUsers((users) => {
        logger.debug('👥 useOnlineUsers: Received online users list:', users);
        setOnlineUsers(users);
      });
      cleanupFunctions.push(cleanupOnlineUsers);

      // Listen for users coming online
      const cleanupUserOnline = onUserOnline((data) => {
        logger.debug('✅ useOnlineUsers: User came online:', data.userId);
        setOnlineUsers((prev) => {
          // Prevent duplicates
          if (!prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          return prev;
        });
      });
      cleanupFunctions.push(cleanupUserOnline);

      // Listen for users going offline
      const cleanupUserOffline = onUserOffline((data) => {
        logger.debug('❌ useOnlineUsers: User went offline:', data.userId);
        setOnlineUsers((prev) => prev.filter(id => id !== data.userId));
      });
      cleanupFunctions.push(cleanupUserOffline);
    };

    // Use shared socket helper with retry logic
    const cancelSocketRetry = setupSocketListeners((socket) => {
      setupListeners(socket);
      // Request online users list after connection (important for mobile/slow connections)
      setTimeout(() => {
        logger.debug('📡 useOnlineUsers: Requesting online users list');
        requestOnlineUsers();
      }, 500);
    });

    // Cleanup on unmount
    return () => {
      logger.debug('🧹 useOnlineUsers: Cleaning up online presence listeners');
      cancelSocketRetry();
      cleanupFunctions.forEach(cleanup => cleanup?.());
    };
  }, []); // Empty dependency array - only set up once

  /**
   * Helper function to check if a specific user is online
   * @param {string} userId - The user ID to check
   * @returns {boolean} True if user is online, false otherwise
   */
  const isUserOnline = (userId) => {
    return onlineUsers.includes(userId);
  };

  return {
    onlineUsers,
    isUserOnline
  };
}

