import dotenv from "dotenv";
dotenv.config();

console.log('🔐 JWT_SECRET from env:', process.env.JWT_SECRET ? 'Set' : 'Not set');
console.log('🔐 JWT_SECRET value:', process.env.JWT_SECRET);

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Import routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import friendsRoutes from './routes/friends.js';
import postsRoutes from './routes/posts.js';
import uploadRoutes from './routes/upload.js';
import notificationsRoutes from './routes/notifications.js';
import messagesRoutes from './routes/messages.js';
import groupChatsRoutes from './routes/groupChats.js';
import pushNotificationsRouter from './routes/pushNotifications.js';
import reportsRoutes from './routes/reports.js';
import blocksRoutes from './routes/blocks.js';
import adminRoutes from './routes/admin.js';
import searchRoutes from './routes/search.js';
import twoFactorRoutes from './routes/twoFactor.js';
import sessionsRoutes from './routes/sessions.js';
import privacyRoutes from './routes/privacy.js';
import bookmarksRoutes from './routes/bookmarks.js';

// Import rate limiters
import {
  globalLimiter,
  loginLimiter,
  signupLimiter,
  postLimiter,
  messageLimiter,
  commentLimiter,
  friendRequestLimiter,
  passwordResetLimiter,
  uploadLimiter,
  searchLimiter
} from './middleware/rateLimiter.js';

import connectDB from "./dbConn.js";
import config from "./config/config.js";

connectDB();

// Import models
import Notification from './models/Notification.js';
import Message from './models/Message.js';
import User from './models/User.js';

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  'https://prydesocial.com',
  'https://www.prydesocial.com',
  'https://prydeapp.com',
  'https://www.prydeapp.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://pryde-frontend.onrender.com',
  'https://pryde-1flx.onrender.com',
  // Cloudflare Pages URLs
  'https://pryde-social.pages.dev',
  /\.pages\.dev$/, // Allow all Cloudflare Pages subdomains
  config.frontendURL,
  config.cloudflareURL
].filter(Boolean); // Remove any undefined values

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware - Enhanced CORS configuration
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin is in allowed list (string match)
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
      return;
    }

    // Check if origin matches any regex patterns
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply global rate limiter to all requests
app.use(globalLimiter);

// Store online users
const onlineUsers = new Map(); // userId -> socketId

// Routes with specific rate limiters
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/groupchats', groupChatsRoutes);
app.use('/api/push', pushNotificationsRouter);
app.use('/api/reports', reportsRoutes);
app.use('/api/blocks', blocksRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/bookmarks', bookmarksRoutes);

// Health check and status endpoints
app.get('/', (req, res) => {
  res.json({ status: 'Pryde API running', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pryde Social API is running', timestamp: new Date().toISOString() });
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running', 
    service: 'Pryde Social API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  console.log('🔌 Socket.IO authentication attempt');
  console.log('🔑 Token received:', token ? 'Yes' : 'No');
  console.log('🔑 Token preview:', token ? token.substring(0, 20) + '...' : 'null');
  console.log('🔐 JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');

  if (!token) {
    console.log('❌ No token provided');
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    console.log('✅ Token verified successfully for user:', decoded.userId);
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    console.log('❌ Error details:', error);
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  const userId = socket.userId;
  console.log(`User connected: ${userId}`);
  
  // Store user's socket connection
  onlineUsers.set(userId, socket.id);
  
  // Emit online status to all users
  io.emit('user_online', { userId });
  
  // Send list of online users to the newly connected user
  socket.emit('online_users', Array.from(onlineUsers.keys()));
  
  // Join user to their personal room for targeted notifications
  socket.join(`user_${userId}`);
  
  // Handle typing indicator
  socket.on('typing', (data) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user_typing', {
        userId: userId,
        isTyping: data.isTyping
      });
    }
  });
  
  // Handle real-time message
  socket.on('send_message', async (data) => {
    try {
      console.log('📤 Saving message to DB:', {
        sender: userId,
        recipient: data.recipientId,
        content: data.content.substring(0, 50)
      });

      const message = new Message({
        sender: userId,
        recipient: data.recipientId,
        content: data.content,
        attachment: data.attachment || null
      });

      await message.save();
      console.log('✅ Message saved to DB with ID:', message._id);

      await message.populate('sender', 'username profilePhoto');
      await message.populate('recipient', 'username profilePhoto');

      // Send to recipient if online
      const recipientSocketId = onlineUsers.get(data.recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('new_message', message);
      }

      // Send back to sender as confirmation
      socket.emit('message_sent', message);

      // Create notification for recipient
      const notification = new Notification({
        recipient: data.recipientId,
        sender: userId,
        type: 'message',
        message: `You have a new message`,
        link: `/messages`
      });
      await notification.save();
      await notification.populate('sender', 'username profilePhoto');

      // Send notification to recipient if online
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('new_notification', notification);
      }
    } catch (error) {
      console.error('❌ Error saving message:', error);
      socket.emit('error', { message: 'Error sending message' });
    }
  });
  
  // Handle friend request notification
  socket.on('friend_request_sent', async (data) => {
    const recipientSocketId = onlineUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('friend_request_received', {
        senderId: userId,
        senderUsername: data.senderUsername,
        senderPhoto: data.senderPhoto
      });
    }
  });
  
  // Handle friend request accepted
  socket.on('friend_request_accepted', async (data) => {
    const requesterSocketId = onlineUsers.get(data.requesterId);
    if (requesterSocketId) {
      io.to(requesterSocketId).emit('friend_request_accepted', {
        accepterId: userId,
        accepterUsername: data.accepterUsername,
        accepterPhoto: data.accepterPhoto
      });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${userId}`);
    onlineUsers.delete(userId);

    // Update lastSeen timestamp
    try {
      await User.findByIdAndUpdate(userId, {
        lastSeen: new Date()
      });
    } catch (error) {
      console.error('Error updating lastSeen:', error);
    }

    // Emit offline status to all users
    io.emit('user_offline', { userId });
  });
});

// Make io accessible in routes
app.set('io', io);
app.set('onlineUsers', onlineUsers);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Base URL: ${config.baseURL}`);
  console.log('Socket.IO server ready for real-time connections');
});
