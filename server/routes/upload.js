import express from 'express';
const router = express.Router();
import multer from 'multer';
import { GridFsStorage } from 'multer-gridfs-storage';
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import config from '../config/config.js';

// Create storage engine
const storage = new GridFsStorage({
  url: config.mongoURI,
  options: { useNewUrlParser: true, useUnifiedTopology: true },
  file: (req, file) => {
    console.log('GridFsStorage processing file:', file.originalname);
    return new Promise((resolve, reject) => {
      const filename = `${Date.now()}-${file.originalname}`;
      const fileInfo = {
        filename: filename,
        bucketName: 'uploads'
      };
      console.log('File info:', fileInfo);
      resolve(fileInfo);
    });
  }
});

// Error handling for storage
storage.on('connection', (db) => {
  console.log('✅ GridFsStorage connected to database');
});

storage.on('connectionFailed', (err) => {
  console.error('❌ GridFsStorage connection failed:', err);
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Init GridFSBucket (modern API)
let gridfsBucket;
mongoose.connection.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
  console.log('GridFS initialized successfully');
});

// @route   POST /api/upload/profile-photo
// @desc    Upload profile photo
// @access  Private
router.post('/profile-photo', auth, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    try {
      console.log('Profile photo upload request received');

      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ message: 'Upload failed', error: err.message });
      }

      console.log('File:', req.file);

      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const photoUrl = `/api/upload/image/${req.file.filename}`;
      console.log('Photo URL:', photoUrl);

      // Update user profile photo
      const updatedUser = await User.findByIdAndUpdate(
        req.userId,
        { profilePhoto: photoUrl },
        { new: true }
      );

      console.log('Profile photo updated for user:', req.userId);
      res.json({ url: photoUrl, user: updatedUser });
    } catch (error) {
      console.error('Upload profile photo error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
});

// @route   POST /api/upload/cover-photo
// @desc    Upload cover photo
// @access  Private
router.post('/cover-photo', auth, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    try {
      console.log('Cover photo upload request received');

      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ message: 'Upload failed', error: err.message });
      }

      console.log('File:', req.file);

      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const photoUrl = `/api/upload/image/${req.file.filename}`;
      console.log('Photo URL:', photoUrl);

      // Update user cover photo
      const updatedUser = await User.findByIdAndUpdate(
        req.userId,
        { coverPhoto: photoUrl },
        { new: true }
      );

      console.log('Cover photo updated for user:', req.userId);
      res.json({ url: photoUrl, user: updatedUser });
    } catch (error) {
      console.error('Upload cover photo error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
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
router.get('/image/:filename', async (req, res) => {
  try {
    if (!gridfsBucket) {
      return res.status(500).json({ message: 'GridFS not initialized' });
    }

    const files = await gridfsBucket.find({ filename: req.params.filename }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = files[0];

    // Check if image
    if (file.contentType === 'image/jpeg' ||
        file.contentType === 'image/png' ||
        file.contentType === 'image/jpg' ||
        file.contentType === 'image/gif' ||
        file.contentType === 'image/webp') {

      res.set('Content-Type', file.contentType);
      const downloadStream = gridfsBucket.openDownloadStreamByName(req.params.filename);
      downloadStream.pipe(res);
    } else {
      res.status(404).json({ message: 'Not an image' });
    }
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ message: 'Error retrieving image' });
  }
});

// @route   GET /api/upload/file/:filename
// @desc    Get any file (image, video, gif)
// @access  Public
router.get('/file/:filename', async (req, res) => {
  try {
    if (!gridfsBucket) {
      return res.status(500).json({ message: 'GridFS not initialized' });
    }

    const files = await gridfsBucket.find({ filename: req.params.filename }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = files[0];

    // Stream the file
    res.set('Content-Type', file.contentType);
    const downloadStream = gridfsBucket.openDownloadStreamByName(req.params.filename);
    downloadStream.pipe(res);
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ message: 'Error retrieving file' });
  }
});

export default router;
