import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { connectDB } from './models/db.js';
import { initializeSockets } from './sockets.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import messagesRoutes from './routes/messages.js';
import { authMiddleware } from './utils/authMiddleware.js';

// Load environment variables
dotenv.config();

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create upload directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const profilePicsDir = path.join(uploadsDir, 'profile-pictures');
const messagesDir = path.join(uploadsDir, 'messages');

[uploadsDir, profilePicsDir, messagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Configure multer for file uploads
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilePicsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  }
});

const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, messagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `message-${uniqueSuffix}${ext}`);
  }
});

const profileUpload = multer({ 
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const messageUpload = multer({ 
  storage: messageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Serve static files
app.use('/frontend', express.static(path.join(__dirname, '..', 'frontend')));
app.use('/uploads', express.static(uploadsDir));

// Upload endpoints
/**
 * POST /api/upload-profile
 * Upload profile picture
 */
app.post('/api/upload-profile', authMiddleware, profileUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imageUrl = `/uploads/profile-pictures/${req.file.filename}`;
    
    // Update user's avatar_url
    req.user.avatar_url = imageUrl;
    await req.user.save();

    res.json({ 
      success: true, 
      imageUrl,
      user: {
        id: req.user._id,
        display_name: req.user.display_name,
        avatar_url: req.user.avatar_url
      }
    });
  } catch (error) {
    console.error('Profile upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

/**
 * POST /api/messages/upload-image
 * Upload message image (returns URL, actual message sent via socket)
 */
app.post('/api/messages/upload-image', authMiddleware, messageUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imageUrl = `/uploads/messages/${req.file.filename}`;

    res.json({ 
      success: true, 
      imageUrl 
    });
  } catch (error) {
    console.error('Message image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/messages', messagesRoutes);

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/frontend/pages/signup.html');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Connect to MongoDB
connectDB();

// Initialize Socket.IO
initializeSockets(io);

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}/frontend/pages/signup.html`);
});
