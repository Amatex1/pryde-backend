import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import { connectDB } from "./config/db.js";
import { setupSockets } from "./sockets.js";
import { authMiddleware } from "./utils/authMiddleware.js";

// Import routes
import authRoutes from "./routes/auth.js";
import messagesRoutes from "./routes/messages.js";
import userRoutes from "./routes/users.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const profilePicsDir = path.join(uploadsDir, 'profile-pictures');
const messagesDir = path.join(uploadsDir, 'messages');

[uploadsDir, profilePicsDir, messagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json());
app.use(rateLimit({ windowMs: 10000, max: 50 }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

// Multer configuration for profile pictures
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilePicsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const profileUpload = multer({ 
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Upload endpoints
app.post('/api/upload-profile', authMiddleware, profileUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/uploads/profile-pictures/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.post('/api/messages/upload-image', authMiddleware, messageUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/uploads/messages/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/users", userRoutes);

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/frontend/pages/signup.html');
});

// Connect to MongoDB
connectDB();

// Setup Socket.io
setupSockets(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`✅ PRYDE backend running on port ${PORT}`);
});

