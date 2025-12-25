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

// File filter to allow images, videos, and audio
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  const allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a'];
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes, ...allowedAudioTypes];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only images (JPEG, PNG, GIF, WebP), videos (MP4, WebM, OGG, MOV), and audio (MP3, WAV, OGG, WebM, M4A) are allowed. Received: ${file.mimetype}`), false);
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
 * Delete a file from GridFS by filename
 * Handles both full URLs and just filenames
 * @param {string} fileUrl - The file URL or filename to delete
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
export const deleteFromGridFS = async (fileUrl) => {
  try {
    if (!gridfsBucket) {
      console.error('❌ GridFS not initialized');
      return false;
    }

    // Extract filename from URL if needed (e.g., /upload/file/1234-image.webp -> 1234-image.webp)
    let filename = fileUrl;
    if (fileUrl.includes('/')) {
      filename = fileUrl.split('/').pop();
    }

    // Find the file in GridFS
    const files = await gridfsBucket.find({ filename }).toArray();

    if (!files || files.length === 0) {
      console.log(`⚠️ File not found in GridFS: ${filename}`);
      return false;
    }

    // Delete the file
    await gridfsBucket.delete(files[0]._id);
    console.log(`🗑️ Deleted file from GridFS: ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting file from GridFS: ${fileUrl}`, error);
    return false;
  }
};

/**
 * Save processed file to GridFS
 * Strips EXIF data from images before saving
 * @param {Object} file - Multer file object
 * @param {boolean|Object} generateSizes - Whether to generate responsive sizes, or options object
 */
const saveToGridFS = async (file, generateSizes = false) => {
  return new Promise(async (resolve, reject) => {
    try {
      let buffer = file.buffer;
      let contentType = file.mimetype;
      let sizes = null;

      // Process and optimize images (strip EXIF, convert to WebP, compress)
      if (file.mimetype.startsWith('image/')) {
        console.log('🔒 Processing and optimizing image...');
        const result = await stripExifData(buffer, file.mimetype, { generateSizes });
        buffer = result.buffer;
        contentType = result.mimetype;
        sizes = result.sizes;
        console.log('✅ Image optimized and saved as', contentType);
      }

      // Update filename extension if converted to WebP
      const timestamp = Date.now();
      let filename = `${timestamp}-${file.originalname}`;
      if (contentType === 'image/webp' && !filename.endsWith('.webp')) {
        filename = filename.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      }

      // Save main image
      const readableStream = Readable.from(buffer);
      const uploadStream = gridfsBucket.openUploadStream(filename, {
        contentType: contentType
      });

      readableStream.pipe(uploadStream);

      uploadStream.on('finish', async () => {
        const result = {
          filename: filename,
          id: uploadStream.id
        };

        // Save responsive sizes if generated (WebP + AVIF formats)
        if (sizes) {
          try {
            const sizeIds = {};
            const baseName = file.originalname.replace(/\.(jpg|jpeg|png)$/i, '');

            // Helper function to save a size variant
            const saveSizeVariant = async (buffer, sizeName, format) => {
              const ext = format === 'avif' ? '.avif' : '.webp';
              const variantFilename = `${timestamp}-${sizeName}-${baseName}${ext}`;
              const variantStream = Readable.from(buffer);
              const variantUpload = gridfsBucket.openUploadStream(variantFilename, {
                contentType: `image/${format}`
              });
              await new Promise((res, rej) => {
                variantStream.pipe(variantUpload);
                variantUpload.on('finish', () => res());
                variantUpload.on('error', rej);
              });
              return variantFilename;
            };

            // Save avatar size (only for profile photos)
            if (sizes.avatar) {
              sizeIds.avatar = {
                webp: await saveSizeVariant(sizes.avatar.webp, 'avatar', 'webp'),
                avif: await saveSizeVariant(sizes.avatar.avif, 'avatar', 'avif')
              };
            }

            // Save feed size
            if (sizes.feed) {
              sizeIds.feed = {
                webp: await saveSizeVariant(sizes.feed.webp, 'feed', 'webp'),
                avif: await saveSizeVariant(sizes.feed.avif, 'feed', 'avif')
              };
            }

            // Save full size
            if (sizes.full) {
              sizeIds.full = {
                webp: await saveSizeVariant(sizes.full.webp, 'full', 'webp'),
                avif: await saveSizeVariant(sizes.full.avif, 'full', 'avif')
              };
            }

            result.sizes = sizeIds;
            console.log('✅ Saved responsive sizes with WebP + AVIF:', Object.keys(sizeIds));
          } catch (sizeError) {
            console.error('❌ Error saving responsive sizes:', sizeError);
            // Continue without sizes
          }
        }

        resolve(result);
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
      console.log('📸 Profile photo upload request received');

      if (err) {
        console.error('❌ Multer error:', err);

        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large',
            message: 'Profile photo exceeds 10MB limit. Please use a smaller image.',
            detail: err.message
          });
        }

        return res.status(500).json({
          error: 'Upload failed',
          message: 'Upload failed. Please try again.',
          detail: err.message
        });
      }

      if (!req.file) {
        console.log('⚠️ No file in request');
        return res.status(400).json({
          error: 'No file received',
          message: 'No file uploaded. Please select an image and try again.'
        });
      }

      // Validate it's an image
      if (!req.file.mimetype.startsWith('image/')) {
        console.error('❌ Invalid file type:', req.file.mimetype);
        return res.status(400).json({
          error: 'Invalid image type',
          message: 'Only image files are allowed for profile photos.',
          detail: `Received: ${req.file.mimetype}`
        });
      }

      // Save to GridFS with EXIF stripping and responsive sizes (avatar-optimized)
      const fileInfo = await saveToGridFS(req.file, { isAvatar: true }); // Generate avatar-optimized sizes

      if (!fileInfo || !fileInfo.filename) {
        throw new Error('Failed to save profile photo to storage');
      }

      const photoUrl = `/upload/image/${fileInfo.filename}`;
      console.log('✅ Photo URL:', photoUrl);

      // Update user profile photo
      const updatedUser = await User.findByIdAndUpdate(
        req.userId,
        { profilePhoto: photoUrl },
        { new: true }
      );

      console.log('✅ Profile photo updated for user:', req.userId);
      res.json({ url: photoUrl, user: updatedUser });
    } catch (error) {
      console.error('❌ Upload profile photo error:', error);
      res.status(500).json({
        error: 'Image upload failed',
        message: 'Profile photo upload failed. Please try again or use a smaller image.',
        detail: error.message
      });
    }
  });
});

// @route   POST /api/upload/cover-photo
// @desc    Upload cover photo
// @access  Private
router.post('/cover-photo', auth, uploadLimiter, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    try {
      console.log('🖼️ Cover photo upload request received');

      if (err) {
        console.error('❌ Multer error:', err);

        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large',
            message: 'Cover photo exceeds 10MB limit. Please use a smaller image.',
            detail: err.message
          });
        }

        return res.status(500).json({
          error: 'Upload failed',
          message: 'Upload failed. Please try again.',
          detail: err.message
        });
      }

      if (!req.file) {
        console.log('⚠️ No file in request');
        return res.status(400).json({
          error: 'No file received',
          message: 'No file uploaded. Please select an image and try again.'
        });
      }

      // Validate it's an image
      if (!req.file.mimetype.startsWith('image/')) {
        console.error('❌ Invalid file type:', req.file.mimetype);
        return res.status(400).json({
          error: 'Invalid image type',
          message: 'Only image files are allowed for cover photos.',
          detail: `Received: ${req.file.mimetype}`
        });
      }

      // Save to GridFS with EXIF stripping and responsive sizes (cover photo doesn't need avatar optimization)
      const fileInfo = await saveToGridFS(req.file, true); // Generate standard responsive sizes

      if (!fileInfo || !fileInfo.filename) {
        throw new Error('Failed to save cover photo to storage');
      }

      const photoUrl = `/upload/image/${fileInfo.filename}`;
      console.log('✅ Photo URL:', photoUrl);

      // Update user cover photo
      const updatedUser = await User.findByIdAndUpdate(
        req.userId,
        { coverPhoto: photoUrl },
        { new: true }
      );

      console.log('✅ Cover photo updated for user:', req.userId);
      res.json({ url: photoUrl, user: updatedUser });
    } catch (error) {
      console.error('❌ Upload cover photo error:', error);
      res.status(500).json({
        error: 'Image upload failed',
        message: 'Cover photo upload failed. Please try again or use a smaller image.',
        detail: error.message
      });
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
        console.error('❌ Multer error:', err);

        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large',
            message: 'File exceeds 10MB limit. Please use a smaller file.',
            detail: err.message
          });
        }

        return res.status(500).json({
          error: 'Upload failed',
          message: 'Upload failed. Please try again.',
          detail: err.message
        });
      }

      if (!req.file) {
        console.log('⚠️ No file in request');
        return res.status(400).json({
          error: 'No file received',
          message: 'No file uploaded. Please select a file and try again.'
        });
      }

      // Save to GridFS with EXIF stripping
      const fileInfo = await saveToGridFS(req.file);

      if (!fileInfo || !fileInfo.filename) {
        throw new Error('Failed to save file to storage');
      }

      const fileUrl = `/upload/image/${fileInfo.filename}`;

      console.log('✅ Chat attachment uploaded successfully');
      res.json({ url: fileUrl });
    } catch (error) {
      console.error('❌ Upload chat attachment error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: 'File upload failed. Please try again or use a smaller file.',
        detail: error.message
      });
    }
  });
});

// @route   POST /api/upload/post-media
// @desc    Upload media for posts (images, videos, gifs) - Max 3 files
// @access  Private
router.post('/post-media', auth, uploadLimiter, (req, res) => {
  upload.array('media', 3)(req, res, async (err) => {
    try {
      // Enhanced error handling for multer errors
      if (err) {
        console.error('❌ Multer error:', err);

        // Provide specific error messages
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large',
            message: 'File size exceeds 10MB limit. Please use a smaller file.',
            detail: err.message
          });
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: 'Too many files',
            message: 'Maximum 3 files allowed per upload.',
            detail: err.message
          });
        }

        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            error: 'Invalid field name',
            message: 'Upload failed. Please try again.',
            detail: err.message
          });
        }

        return res.status(500).json({
          error: 'Upload failed',
          message: 'Upload failed. Please try again.',
          detail: err.message
        });
      }

      if (!req.files || req.files.length === 0) {
        console.log('⚠️ No files in request');
        return res.status(400).json({
          error: 'No file received',
          message: 'No files uploaded. Please select a file and try again.'
        });
      }

      // Validate file types
      for (const file of req.files) {
        if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
          console.error('❌ Invalid file type:', file.mimetype);
          return res.status(400).json({
            error: 'Invalid file type',
            message: 'Only images and videos are allowed.',
            detail: `Received: ${file.mimetype}`
          });
        }
      }

      console.log(`📤 Processing ${req.files.length} file(s)...`);

      // Process each file and save to GridFS with EXIF stripping and responsive sizes
      const mediaUrls = await Promise.all(req.files.map(async (file) => {
        // Generate responsive sizes for images (not videos or GIFs)
        const shouldGenerateSizes = file.mimetype.startsWith('image/') && file.mimetype !== 'image/gif';
        const fileInfo = await saveToGridFS(file, shouldGenerateSizes);

        if (!fileInfo || !fileInfo.filename) {
          throw new Error('Failed to save file to storage');
        }

        const url = `/upload/file/${fileInfo.filename}`;
        let type = 'image';

        if (file.mimetype.startsWith('video/')) {
          type = 'video';
        } else if (file.mimetype === 'image/gif') {
          type = 'gif';
        }

        const result = { url, type };

        // Include responsive size URLs if generated
        if (fileInfo.sizes) {
          result.sizes = {
            thumbnail: fileInfo.sizes.thumbnail ? `/upload/file/${fileInfo.sizes.thumbnail}` : null,
            small: fileInfo.sizes.small ? `/upload/file/${fileInfo.sizes.small}` : null,
            medium: fileInfo.sizes.medium ? `/upload/file/${fileInfo.sizes.medium}` : null
          };
        }

        return result;
      }));

      console.log(`✅ Successfully uploaded ${mediaUrls.length} file(s)`);
      res.json({ media: mediaUrls });
    } catch (error) {
      console.error('❌ Upload post media error:', error);
      res.status(500).json({
        error: 'Image upload failed',
        message: 'Image upload failed. Please try again or use a smaller image.',
        detail: error.message
      });
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

// @route   POST /api/upload/voice-note
// @desc    Upload voice note (audio file)
// @access  Private
router.post('/voice-note', auth, uploadLimiter, (req, res) => {
  upload.single('audio')(req, res, async (err) => {
    try {
      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({ message: 'Upload failed', error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No audio file uploaded' });
      }

      // Save to GridFS (no EXIF stripping for audio)
      const fileInfo = await saveToGridFS(req.file);
      const audioUrl = `/upload/file/${fileInfo.filename}`;

      res.json({ url: audioUrl, duration: req.body.duration || null });
    } catch (error) {
      console.error('Upload voice note error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
});

export default router;
