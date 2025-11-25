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
        socket = io(SOCKET_URL, {
            transports: ["websocket"],
            query: { userId },
        });
    }
    return socket;
};

// Disconnect socket
export const disconnectSocket = () => {
    if (socket) socket.disconnect();
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
    if (socket) socket.on("userOnline", callback);
};

export const onUserOffline = (callback) => {
    if (socket) socket.on("userOffline", callback);
};

export const onOnlineUsers = (callback) => {
    if (socket) socket.on("onlineUsers", callback);
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
