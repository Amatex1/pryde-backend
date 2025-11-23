import express from 'express';
const router = express.Router();
import multer from 'multer';
import { GridFsStorage } from 'multer-gridfs-storage';
import Grid from 'gridfs-stream';
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import config from '../config/config.js';

// Create storage engine
const storage = new GridFsStorage({
  url: config.mongoURI,
  file: (req, file) => {
    return {
      filename: `${Date.now()}-${file.originalname}`,
      bucketName: 'uploads'
    };
  }
});

const upload = multer({ storage });

// Init gfs
let gfs;
mongoose.connection.once('open', () => {
  gfs = Grid(mongoose.connection.db, mongoose.mongo);
  gfs.collection('uploads');
});

// @route   POST /api/upload/profile-photo
// @desc    Upload profile photo
// @access  Private
router.post('/profile-photo', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const photoUrl = `/api/upload/image/${req.file.filename}`;

    // Update user profile photo
    await User.findByIdAndUpdate(req.userId, {
      profilePhoto: photoUrl
    });

    res.json({ url: photoUrl });
  } catch (error) {
    console.error('Upload profile photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/upload/cover-photo
// @desc    Upload cover photo
// @access  Private
router.post('/cover-photo', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const photoUrl = `/api/upload/image/${req.file.filename}`;

    // Update user cover photo
    await User.findByIdAndUpdate(req.userId, {
      coverPhoto: photoUrl
    });

    res.json({ url: photoUrl });
  } catch (error) {
    console.error('Upload cover photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/upload/chat-attachment
// @desc    Upload chat attachment
// @access  Private
router.post('/chat-attachment', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `/api/upload/image/${req.file.filename}`;

    res.json({ url: fileUrl });
  } catch (error) {
    console.error('Upload chat attachment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/upload/post-media
// @desc    Upload media for posts (images, videos, gifs)
// @access  Private
router.post('/post-media', auth, upload.array('media', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const mediaUrls = req.files.map(file => {
      const url = `/api/upload/file/${file.filename}`;
      let type = 'image';

      if (file.mimetype.startsWith('video/')) {
        type = 'video';
      } else if (file.mimetype === 'image/gif') {
        type = 'gif';
      }

      return { url, type };
    });

    res.json({ media: mediaUrls });
  } catch (error) {
    console.error('Upload post media error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/upload/image/:filename
// @desc    Get image
// @access  Public
router.get('/image/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check if image
    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png' || file.contentType === 'image/jpg') {
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({ message: 'Not an image' });
    }
  });
});

// @route   GET /api/upload/file/:filename
// @desc    Get any file (image, video, gif)
// @access  Public
router.get('/file/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Stream the file
    const readstream = gfs.createReadStream(file.filename);
    res.set('Content-Type', file.contentType);
    readstream.pipe(res);
  });
});

export default router;
