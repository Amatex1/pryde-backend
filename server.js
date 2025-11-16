import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { connectDB } from "./config/db.js";
import { setupSockets } from "./sockets.js";
import authRoutes from "./routes/auth.js";
import messageRoutes from "./routes/messages.js";
import { auth } from "./middleware/auth.js";
import User from "./models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Create uploads directories
const uploadsDir = path.join(__dirname, 'uploads');
const profilePicturesDir = path.join(uploadsDir, 'profile-pictures');
const messagesDir = path.join(uploadsDir, 'messages');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(profilePicturesDir)) fs.mkdirSync(profilePicturesDir, { recursive: true });
if (!fs.existsSync(messagesDir)) fs.mkdirSync(messagesDir, { recursive: true });

// Multer configuration for profile pictures
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilePicturesDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Multer configuration for message images
const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, messagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const messageUpload = multer({
  storage: messageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());
app.use(rateLimit({ windowMs: 10000, max: 100 }));

// Serve uploads directory
app.use('/uploads', express.static(uploadsDir));

// Serve frontend
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

// Profile picture upload endpoint
app.post('/api/upload-profile', auth, profileUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const avatarUrl = `/uploads/profile-pictures/${req.file.filename}`;
    
    await User.findByIdAndUpdate(req.userId, { avatar_url: avatarUrl });
    
    res.json({ 
      success: true, 
      avatar_url: avatarUrl 
    });
  } catch (error) {
    console.error('Profile upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Message image upload endpoint
app.post('/api/messages/upload-image', auth, messageUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const imageUrl = `/uploads/messages/${req.file.filename}`;
    
    res.json({ 
      success: true, 
      image_url: imageUrl 
    });
  } catch (error) {
    console.error('Message image upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Setup Socket.io
setupSockets(io);

// Connect to database and start server
connectDB().then(() => {
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`✅ PRYDE backend running on port ${PORT}`);
  });
});
