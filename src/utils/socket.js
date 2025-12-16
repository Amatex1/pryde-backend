// src/utils/socket.js
import { io } from "socket.io-client";
import API_CONFIG from "../config/api";
import logger from './logger';

const SOCKET_URL = API_CONFIG.SOCKET_URL;

let socket = null;
// Initialize socket with userId (Blink expects this)
export const initializeSocket = (userId) => {
    return connectSocket(userId);
};

// Connect socket
export const connectSocket = (userId) => {
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

        logger.debug('🔌 Connecting socket with userId:', userId);
        logger.debug('🔑 Token exists:', !!token);
        logger.debug('🔑 Token preview:', token ? token.substring(0, 20) + '...' : 'null');

        socket = io(SOCKET_URL, {
            // Use polling first for faster connection on Render
            transports: ["polling", "websocket"],
            auth: {
                token: token
            },
            query: { userId },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            timeout: 10000, // 10 second timeout instead of default 20s
            forceNew: true, // Force new connection to use new token
            upgrade: true, // Allow upgrade to websocket after polling connects
        });

        // Add connection event listeners
        socket.on('connect', () => {
            logger.debug('✅ Socket connected successfully!');
            logger.debug('🔌 Transport:', socket.io.engine.transport.name);
        });

        socket.on('connect_error', (error) => {
            logger.error('❌ Socket connection error:', error.message);
        });

        socket.on('disconnect', (reason) => {
            logger.debug('🔌 Socket disconnected:', reason);
        });

        // Listen for force logout (session terminated from another device)
        socket.on('force_logout', (data) => {
            logger.debug('🚪 Force logout received:', data.reason);
            alert(`You have been logged out: ${data.reason}`);
            // Clear local storage and redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('user');
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
        socket.disconnect();
        socket = null;
    }
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
