// src/utils/socket.js
import { io } from "socket.io-client";
import API_CONFIG from "../config/api";

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

        console.log('🔌 Connecting socket with userId:', userId);
        console.log('🔑 Token exists:', !!token);
        console.log('🔑 Token preview:', token ? token.substring(0, 20) + '...' : 'null');

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
            console.log('✅ Socket connected successfully!');
            console.log('🔌 Transport:', socket.io.engine.transport.name);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error.message);
        });

        socket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
        });

        // Log transport upgrades
        socket.io.engine.on('upgrade', (transport) => {
            console.log('⬆️ Socket upgraded to:', transport.name);
        });
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
        console.log('🔌 Socket connected:', socket.connected);
        console.log('📤 Emitting send_message:', data);
        socket.emit("send_message", data);
    } else {
        console.error('❌ Socket not initialized!');
    }
};

export const onMessageSent = (callback) => {
    if (socket) {
        socket.off("message_sent"); // Remove previous listener
        socket.on("message_sent", callback);
    }
};

export const onNewMessage = (callback) => {
    if (socket) {
        socket.off("new_message"); // Remove previous listener
        socket.on("new_message", callback);
    }
};

// -----------------------------
// TYPING INDICATOR
// -----------------------------
export const emitTyping = (conversationId, userId) => {
    if (socket) socket.emit("typing", { conversationId, userId });
};

export const onUserTyping = (callback) => {
    if (socket) {
        socket.off("typing"); // Remove previous listener
        socket.on("typing", callback);
    }
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
    if (socket) socket.on("friendRequestReceived", callback);
};

export const onFriendRequestAccepted = (callback) => {
    if (socket) socket.on("friendRequestAccepted", callback);
};

// -----------------------------
// ONLINE STATUS
// -----------------------------
export const onUserOnline = (callback) => {
    if (socket) {
        socket.off("user_online"); // Remove previous listener
        socket.on("user_online", (data) => {
            console.log('🔌 Socket received user_online event:', data);
            callback(data);
        });
    }
};

export const onUserOffline = (callback) => {
    if (socket) {
        socket.off("user_offline"); // Remove previous listener
        socket.on("user_offline", (data) => {
            console.log('🔌 Socket received user_offline event:', data);
            callback(data);
        });
    }
};

export const onOnlineUsers = (callback) => {
    if (socket) {
        socket.off("online_users"); // Remove previous listener
        socket.on("online_users", (users) => {
            console.log('🔌 Socket received online_users event:', users);
            callback(users);
        });
    }
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
    onUserOnline,
    onUserOffline,
    onOnlineUsers
};
