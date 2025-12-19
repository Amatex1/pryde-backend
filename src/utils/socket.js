// src/utils/socket.js
import { io } from "socket.io-client";
import API_CONFIG from "../config/api";
import logger from './logger';

const SOCKET_URL = API_CONFIG.SOCKET_URL;

let socket = null;
let isLoggingOut = false; // Flag to prevent reconnection during logout

// Initialize socket with userId (Blink expects this)
export const initializeSocket = (userId) => {
    return connectSocket(userId);
};

// Connect socket
export const connectSocket = (userId) => {
    // 🔥 CRITICAL: Don't reconnect if we're logging out
    if (isLoggingOut) {
        logger.debug('🚫 Skipping socket connection - logout in progress');
        return null;
    }

    if (!socket) {
        // Get JWT token from localStorage
        const token = localStorage.getItem('token');
        const tokenSetTime = localStorage.getItem('tokenSetTime');

        // Check if token is expired (older than 15 minutes)
        if (tokenSetTime) {
            const ageMinutes = (Date.now() - parseInt(tokenSetTime)) / 1000 / 60;
            if (ageMinutes > 15) {
                logger.warn('⚠️ Token expired, not connecting socket. Token will be refreshed on next API call.');
                return null;
            }
        }

        logger.debug('🔌 Connecting socket (userId from JWT)');
        logger.debug('🔑 Token exists:', !!token);
        logger.debug('🔑 Token preview:', token ? token.substring(0, 20) + '...' : 'null');

        socket = io(SOCKET_URL, {
            // ✅ WebSocket first for better performance, polling as fallback
            transports: ["websocket", "polling"],
            // ✅ Send JWT via auth object (NOT query params)
            // Identity comes from verified JWT, not client-provided userId
            auth: {
                token: token
            },
            // ❌ REMOVED: query: { userId } - Identity now from JWT only
            // ✅ Conditional reconnection (disabled during logout)
            reconnection: true,
            reconnectionAttempts: Infinity, // Never give up reconnecting
            reconnectionDelay: 1000, // Start with 1 second
            reconnectionDelayMax: 5000, // Max 5 seconds between attempts
            timeout: 20000, // 20 second timeout for better stability
            forceNew: true, // Force new connection to use new token
            upgrade: true, // Allow upgrade to websocket after polling connects
            withCredentials: true // Enable cookies for cross-origin
        });

        // Add connection event listeners
        socket.on('connect', () => {
            logger.debug('✅ Socket connected successfully!');
            logger.debug('🔌 Transport:', socket.io.engine.transport.name);
        });

        socket.on('connect_error', (error) => {
            logger.error('❌ Socket connection error:', error.message);

            // 🔥 CRITICAL: If we're logging out, stop reconnection attempts
            if (isLoggingOut) {
                logger.debug('🚫 Stopping reconnection - logout in progress');
                socket.io.opts.reconnection = false;
                socket.disconnect();
            }
        });

        socket.on('disconnect', (reason) => {
            logger.debug('🔌 Socket disconnected:', reason);

            // 🔥 CRITICAL: If we're logging out, prevent reconnection
            if (isLoggingOut) {
                logger.debug('🚫 Preventing reconnection - logout in progress');
                socket.io.opts.reconnection = false;
            }
        });

        // Listen for force logout (session terminated from another device or manual logout)
        socket.on('force_logout', (data) => {
            logger.debug('🚪 Force logout received:', data.reason);

            // 🔥 CRITICAL: Set logout flag to prevent reconnection
            isLoggingOut = true;

            // Disable reconnection immediately
            if (socket) {
                socket.io.opts.reconnection = false;
                socket.disconnect();
                socket = null;
            }

            // Clear all auth state
            localStorage.removeItem('token');
            localStorage.removeItem('tokenSetTime');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            sessionStorage.clear();

            // Show message if not a final logout (from another device)
            if (!data.final) {
                alert(`You have been logged out: ${data.reason}`);
            }

            // Redirect to login
            window.location.href = '/login';
        });

        // Log transport upgrades
        socket.io.engine.on('upgrade', (transport) => {
            logger.debug('⬆️ Socket upgraded to:', transport.name);
        });

        // Handle page visibility changes for bfcache compatibility
        // IMPORTANT: Close WebSocket BEFORE page is cached to allow bfcache
        const handlePageHide = (event) => {
            // Always disconnect on pagehide to allow bfcache
            logger.debug('📦 Page hiding, disconnecting socket for bfcache');
            if (socket && socket.connected) {
                socket.disconnect();
            }
        };

        const handlePageShow = (event) => {
            if (event.persisted) {
                // Page restored from cache, reconnect socket
                logger.debug('📦 Page restored from cache, reconnecting socket');
                if (socket && !socket.connected) {
                    socket.connect();
                }
            }
        };

        // Use 'pagehide' instead of 'beforeunload' for better bfcache support
        window.addEventListener('pagehide', handlePageHide, { capture: true });
        window.addEventListener('pageshow', handlePageShow, { capture: true });
    }
    return socket;
};

// Disconnect socket
export const disconnectSocket = () => {
    if (socket) {
        logger.debug('🔌 Disconnecting socket');
        socket.disconnect();
        socket = null;
    }
};

// 🔥 NEW: Disconnect socket for logout (prevents reconnection)
export const disconnectSocketForLogout = () => {
    logger.debug('🚪 Disconnecting socket for logout');

    // Set logout flag to prevent reconnection
    isLoggingOut = true;

    if (socket) {
        // Disable reconnection
        socket.io.opts.reconnection = false;

        // Disconnect
        socket.disconnect();
        socket = null;
    }
};

// 🔥 NEW: Reset logout flag (for testing or re-login)
export const resetLogoutFlag = () => {
    isLoggingOut = false;
    logger.debug('🔄 Logout flag reset');
};

// Get socket instance
export const getSocket = () => socket;

// Check if socket is connected
export const isSocketConnected = () => socket && socket.connected;

// -----------------------------
// MESSAGES
// -----------------------------
export const sendMessage = (data) => {
    if (socket) {
        logger.debug('🔌 Socket connected:', socket.connected);
        logger.debug('📤 Emitting send_message:', data);
        socket.emit("send_message", data);
    } else {
        logger.error('❌ Socket not initialized!');
    }
};

export const onMessageSent = (callback) => {
    if (socket) {
        // Don't remove previous listeners - allow multiple components to listen
        socket.on("message_sent", callback);
    }
    // Return cleanup function
    return () => {
        if (socket) {
            socket.off("message_sent", callback);
        }
    };
};

export const onNewMessage = (callback) => {
    if (socket) {
        // Don't remove previous listeners - allow multiple components to listen
        socket.on("new_message", callback);
    }
    // Return cleanup function
    return () => {
        if (socket) {
            socket.off("new_message", callback);
        }
    };
};

// -----------------------------
// TYPING INDICATOR
// -----------------------------
export const emitTyping = (conversationId, userId) => {
    if (socket) socket.emit("typing", { conversationId, userId });
};

export const onUserTyping = (callback) => {
    if (socket) {
        // Don't remove previous listeners - allow multiple components to listen
        socket.on("typing", callback);
    }
    // Return cleanup function
    return () => {
        if (socket) {
            socket.off("typing", callback);
        }
    };
};

// -----------------------------
// FRIEND REQUESTS
// -----------------------------
export const emitFriendRequestSent = (data) => {
    if (socket) socket.emit("friendRequestSent", data);
};

export const emitFriendRequestAccepted = (data) => {
    if (socket) socket.emit("friendRequestAccepted", data);
};

export const onFriendRequestReceived = (callback) => {
    if (socket) {
        socket.on("friendRequestReceived", callback);
        return () => {
            if (socket) {
                socket.off("friendRequestReceived", callback);
            }
        };
    }
    return () => {};
};

export const onFriendRequestAccepted = (callback) => {
    if (socket) {
        socket.on("friendRequestAccepted", callback);
        return () => {
            if (socket) {
                socket.off("friendRequestAccepted", callback);
            }
        };
    }
    return () => {};
};

// -----------------------------
// ONLINE STATUS
// -----------------------------
// Request online users list from server
export const requestOnlineUsers = () => {
    if (socket && socket.connected) {
        logger.debug('📡 Requesting online users list from server');
        socket.emit('get_online_users');
    } else {
        logger.warn('⚠️ Cannot request online users - socket not connected');
    }
};

export const onUserOnline = (callback) => {
    if (socket) {
        // Create a named handler function so we can remove it later
        const handler = (data) => {
            logger.debug('🔌 Socket received user_online event:', data);
            callback(data);
        };
        socket.on("user_online", handler);

        // Return cleanup function that removes THIS specific handler
        return () => {
            if (socket) {
                socket.off("user_online", handler);
            }
        };
    }
    return () => {}; // Return empty cleanup if no socket
};

export const onUserOffline = (callback) => {
    if (socket) {
        // Create a named handler function so we can remove it later
        const handler = (data) => {
            logger.debug('🔌 Socket received user_offline event:', data);
            callback(data);
        };
        socket.on("user_offline", handler);

        // Return cleanup function that removes THIS specific handler
        return () => {
            if (socket) {
                socket.off("user_offline", handler);
            }
        };
    }
    return () => {}; // Return empty cleanup if no socket
};

export const onOnlineUsers = (callback) => {
    if (socket) {
        // Create a named handler function so we can remove it later
        const handler = (users) => {
            logger.debug('🔌 Socket received online_users event:', users);
            callback(users);
        };
        socket.on("online_users", handler);

        // Return cleanup function that removes THIS specific handler
        return () => {
            if (socket) {
                socket.off("online_users", handler);
            }
        };
    }
    return () => {}; // Return empty cleanup if no socket
};

export default {
    initializeSocket,
    connectSocket,
    disconnectSocket,
    disconnectSocketForLogout,
    resetLogoutFlag,
    sendMessage,
    onMessageSent,
    onNewMessage,
    emitTyping,
    onUserTyping,
    emitFriendRequestSent,
    emitFriendRequestAccepted,
    onFriendRequestReceived,
    onFriendRequestAccepted,
    requestOnlineUsers,
    onUserOnline,
    onUserOffline,
    onOnlineUsers
};
