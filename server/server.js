import dotenv from "dotenv";
dotenv.config();

// Only log in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔐 JWT_SECRET from env:', process.env.JWT_SECRET ? 'Set' : 'Not set');
}

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";

// Import routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
// PHASE 1 REFACTOR: Friends system kept for backward compatibility
import friendsRoutes from './routes/friends.js';
import followRoutes from './routes/follow.js';
import postsRoutes from './routes/posts.js';
import feedRoutes from './routes/feed.js'; // PHASE 2: Global and Following feeds
import journalsRoutes from './routes/journals.js'; // PHASE 3: Journaling
import longformRoutes from './routes/longform.js'; // PHASE 3: Longform posts
import tagsRoutes, { initializeTags } from './routes/tags.js'; // PHASE 4: Community tags
import photoEssaysRoutes from './routes/photoEssays.js'; // PHASE 5: Photo essays
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
import passkeyRoutes from './routes/passkey.js';
import eventsRoutes from './routes/events.js';

// Import middleware
import auth from './middleware/auth.js';

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
import User from './models/User.js';
import Message from './models/Message.js';

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  // Production domains (replace with your actual domain)
  'https://prydesocial.com',
  'https://www.prydesocial.com',
  'https://prydeapp.com',
  'https://www.prydeapp.com',
  // Development
  'http://localhost:3000',
  'http://localhost:5173',
  // Render URLs
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200
};

// Trust proxy - required for Render and rate limiting
app.set('trust proxy', 1);

// HTTPS enforcement in production
if (config.nodeEnv === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// Security middleware - Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", ...allowedOrigins.filter(o => typeof o === 'string')],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for uploads
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// MongoDB injection protection
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    if (config.nodeEnv === 'development') {
      console.warn(`⚠️ Sanitized key: ${key}`);
    }
  },
}));

// XSS protection is handled by:
// 1. express-mongo-sanitize (above) - prevents NoSQL injection
// 2. helmet (above) - sets security headers including Content-Security-Policy
// 3. express-validator in routes - validates and sanitizes input fields
// Note: xss-clean is deprecated, so we use the combination above instead

app.use(cors(corsOptions));
app.use(cookieParser()); // Parse cookies for CSRF tokens
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply global rate limiter to all requests
app.use(globalLimiter);

// Note: CSRF protection is handled via JWT tokens for API routes
// JWT authentication provides sufficient protection against CSRF for API endpoints
// For traditional form-based routes, use the csrf middleware from middleware/csrf.js

// Store online users
const onlineUsers = new Map(); // userId -> socketId

// Routes with specific rate limiters
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
// PHASE 1 REFACTOR: Friends routes kept for backward compatibility
app.use('/api/friends', friendsRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/feed', feedRoutes); // PHASE 2: Global and Following feeds
app.use('/api/journals', journalsRoutes); // PHASE 3: Journaling
app.use('/api/longform', longformRoutes); // PHASE 3: Longform posts
app.use('/api/tags', tagsRoutes); // PHASE 4: Community tags
app.use('/api/photo-essays', photoEssaysRoutes); // PHASE 5: Photo essays
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
app.use('/api/events', eventsRoutes);

// Debug: Log the passkey router before registering
console.log('🔍 Passkey router type:', typeof passkeyRoutes);
console.log('🔍 Passkey router stack length:', passkeyRoutes?.stack?.length);

app.use('/api/passkey', passkeyRoutes);

// Log passkey routes registration
console.log('✅ Passkey routes registered at /api/passkey');
console.log('   Available routes:');
console.log('   - GET  /api/passkey/test');
console.log('   - POST /api/passkey/register-start');
console.log('   - POST /api/passkey/register-finish');
console.log('   - POST /api/passkey/login-start');
console.log('   - POST /api/passkey/login-finish');
console.log('   - GET  /api/passkey/list');
console.log('   - DELETE /api/passkey/:credentialId');

// Debug: List all registered routes
console.log('\n🔍 All registered /api routes:');
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(`   ${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    console.log(`   Router: ${middleware.regexp}`);
  }
});

// Health check and status endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'Pryde API running',
    timestamp: new Date().toISOString(),
    passkeySupport: !!passkeyRoutes,
    version: '1.0.1-passkey-debug'
  });
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

  if (config.nodeEnv === 'development') {
    console.log('🔌 Socket.IO authentication attempt');
    console.log('🔑 Token received:', token ? 'Yes' : 'No');
  }

  if (!token) {
    if (config.nodeEnv === 'development') {
      console.log('❌ No token provided');
    }
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (config.nodeEnv === 'development') {
      console.log('✅ Token verified successfully');
    }
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    if (config.nodeEnv === 'development') {
      console.log('❌ Token verification failed:', error.message);
    }
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

  // Handle request for online users list (for mobile/slow connections)
  socket.on('get_online_users', () => {
    console.log(`📡 User ${userId} requested online users list`);
    socket.emit('online_users', Array.from(onlineUsers.keys()));
  });

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
      const message = new Message({
        sender: userId,
        recipient: data.recipientId,
        content: data.content,
        attachment: data.attachment || null
      });

      await message.save();

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
