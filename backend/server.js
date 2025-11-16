import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { connectDB } from './config/db.js';
import { initializeSockets } from './sockets.js';
import authRoutes from './routes/auth.js';
import messageRoutes from './routes/messages.js';
import { authMiddleware } from './utils/authMiddleware.js';
import User from './models/User.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts, please try again later.'
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 uploads per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many upload attempts, please try again later.'
});

// Middleware
app.use(cors());
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directories
const uploadsDir = path.join(__dirname, 'uploads');
const profilePicturesDir = path.join(uploadsDir, 'profile-pictures');
const messagesDir = path.join(uploadsDir, 'messages');

[uploadsDir, profilePicturesDir, messagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Serve static files (uploads and frontend)
app.use('/uploads', express.static(uploadsDir));
app.use('/frontend', express.static(path.join(__dirname, '..', 'frontend')));

// Configure multer for profile picture uploads
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilePicturesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Configure multer for message image uploads
const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, messagesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const messageUpload = multer({
  storage: messageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/messages', generalLimiter, messageRoutes);

/**
 * POST /api/upload-profile
 * Upload profile picture
 */
app.post('/api/upload-profile', uploadLimiter, authMiddleware, profileUpload.single('profile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/profile-pictures/${req.file.filename}`;

    // Update user's avatar_url
    await User.findByIdAndUpdate(req.userId, { avatar_url: avatarUrl });

    res.json({
      success: true,
      avatar_url: avatarUrl
    });
  } catch (error) {
    console.error('Profile upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * POST /api/messages/upload-image
 * Upload message image
 */
app.post('/api/messages/upload-image', uploadLimiter, authMiddleware, messageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imageUrl = `/uploads/messages/${req.file.filename}`;

    res.json({
      success: true,
      image_url: imageUrl
    });
  } catch (error) {
    console.error('Message image upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * GET /api/users
 * Get list of all users (for directory)
 */
app.get('/api/users', generalLimiter, authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ banned: false })
      .select('display_name avatar_url bio created_at')
      .sort({ created_at: -1 })
      .lean();

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/profile
 * Get current user profile
 */
app.get('/api/profile', generalLimiter, authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password')
      .lean();

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/profile
 * Update user profile
 */
app.put('/api/profile', generalLimiter, authMiddleware, async (req, res) => {
  try {
    const { display_name, bio } = req.body;
    const updates = {};

    if (display_name) updates.display_name = display_name;
    if (bio !== undefined) updates.bio = bio;

    const user = await User.findByIdAndUpdate(
      req.userId,
      updates,
      { new: true }
    ).select('-password').lean();

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Root route - redirect to signup
app.get('/', (req, res) => {
  res.redirect('/frontend/pages/signup.html');
});

// Connect to database
connectDB();

// Initialize Socket.io
initializeSockets(httpServer);

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`✅ PRYDE backend running on port ${PORT}`);
  console.log(`📁 Frontend: http://localhost:${PORT}/frontend/pages/signup.html`);
});

