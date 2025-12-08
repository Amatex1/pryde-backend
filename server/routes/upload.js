import express from 'express';
const router = express.Router();
import multer from 'multer';
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import config from '../config/config.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { stripExifData } from '../middleware/imageProcessing.js';
import { Readable } from 'stream';

// Use memory storage to process images before saving to GridFS
const storage = multer.memoryStorage();

// File filter to only allow images and videos
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM, OGG, MOV) are allowed. Received: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only 1 file at a time
  },
  fileFilter: fileFilter
});

// Init GridFSBucket (modern API)
let gridfsBucket;
mongoose.connection.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
  console.log('GridFS initialized successfully');
});

/**
 * Save processed file to GridFS
 * Strips EXIF data from images before saving
 */
const saveToGridFS = async (file) => {
  return new Promise(async (resolve, reject) => {
    try {
      let buffer = file.buffer;

      // Strip EXIF data from images
      if (file.mimetype.startsWith('image/')) {
        console.log('🔒 Stripping EXIF data from image...');
        buffer = await stripExifData(buffer, file.mimetype);
        console.log('✅ EXIF data removed');
      }

      const filename = `${Date.now()}-${file.originalname}`;
      const readableStream = Readable.from(buffer);

      const uploadStream = gridfsBucket.openUploadStream(filename, {
        contentType: file.mimetype
      });

      readableStream.pipe(uploadStream);

      uploadStream.on('finish', () => {
        resolve({
          filename: filename,
          id: uploadStream.id
        });
      });

      uploadStream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

// @route   POST /api/upload/profile-photo
// @desc    Upload profile photo
// @access  Private
router.post('/profile-photo', auth, uploadLimiter, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    try {
      console.log('Profile photo upload request received');

      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ message: 'Upload failed', error: err.message });
      }

      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Save to GridFS with EXIF stripping
      const fileInfo = await saveToGridFS(req.file);
      const photoUrl = `/upload/image/${fileInfo.filename}`;
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
router.post('/cover-photo', auth, uploadLimiter, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    try {
      console.log('Cover photo upload request received');

      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ message: 'Upload failed', error: err.message });
      }

      if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Save to GridFS with EXIF stripping
      const fileInfo = await saveToGridFS(req.file);
      const photoUrl = `/upload/image/${fileInfo.filename}`;
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
router.post('/chat-attachment', auth, uploadLimiter, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ message: 'Upload failed', error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Save to GridFS with EXIF stripping
      const fileInfo = await saveToGridFS(req.file);
      const fileUrl = `/upload/image/${fileInfo.filename}`;

      res.json({ url: fileUrl });
    } catch (error) {
      console.error('Upload chat attachment error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
});

// @route   POST /api/upload/post-media
// @desc    Upload media for posts (images, videos, gifs) - Max 3 files
// @access  Private
router.post('/post-media', auth, uploadLimiter, (req, res) => {
  upload.array('media', 3)(req, res, async (err) => {
    try {
      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ message: 'Upload failed', error: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      // Process each file and save to GridFS with EXIF stripping
      const mediaUrls = await Promise.all(req.files.map(async (file) => {
        const fileInfo = await saveToGridFS(file);
        const url = `/upload/file/${fileInfo.filename}`;
        let type = 'image';

        if (file.mimetype.startsWith('video/')) {
          type = 'video';
        } else if (file.mimetype === 'image/gif') {
          type = 'gif';
        }

        return { url, type };
      }));

      res.json({ media: mediaUrls });
    } catch (error) {
      console.error('Upload post media error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
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

      // Set CORS headers to prevent CORB
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.set('Content-Type', file.contentType);
      res.set('Cache-Control', 'public, max-age=31536000');

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

    // Set CORS headers to prevent CORB
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Content-Type', file.contentType);
    res.set('Cache-Control', 'public, max-age=31536000');

    // Stream the file
    const downloadStream = gridfsBucket.openDownloadStreamByName(req.params.filename);
    downloadStream.pipe(res);
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ message: 'Error retrieving file' });
  }
});

export default router;
