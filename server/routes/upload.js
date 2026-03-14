import express from 'express';
const router = express.Router();
import multer from 'multer';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { spawn } from 'child_process';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import TempMedia from '../models/TempMedia.js';
import MediaHash from '../models/MediaHash.js';
import config from '../config/config.js';
import { uploadLimiter, userUploadLimiter, uploadQuotaMiddleware } from '../middleware/rateLimiter.js';
import { stripExifData, validateImageDimensions } from '../middleware/imageProcessing.js';
import { Readable } from 'stream';
// R2 Storage import
import { initR2, uploadToR2, deleteFromR2, getObjectStream, isR2Enabled } from '../utils/r2Storage.js';
import { createLogger } from '../utils/logger.js';
// Malware scanning hook (pluggable: FILE_SCAN_PROVIDER=none|clamav|virustotal)
import { fileScanMiddleware } from '../services/fileScanService.js';

const logger = createLogger('upload');

// Initialize R2 on module load
initR2();

// PART 12: Strip video/audio metadata via ffmpeg (fail gracefully if unavailable)
// Uses -c copy (stream copy) so no re-encode — metadata-only strip
const stripAVMetadata = (inputBuffer, mimetype) => {
  return new Promise((resolve) => {
    const formatMap = {
      'video/mp4': 'mp4', 'video/quicktime': 'mp4',
      'video/webm': 'webm', 'video/ogg': 'ogg',
      'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
      'audio/wav': 'wav', 'audio/ogg': 'ogg',
      'audio/webm': 'webm', 'audio/m4a': 'ipod'
    };
    const format = formatMap[mimetype];
    if (!format) return resolve(inputBuffer);

    const chunks = [];
    let settled = false;
    const done = (buf) => { if (!settled) { settled = true; resolve(buf); } };

    try {
      const ff = spawn('ffmpeg', [
        '-v', 'quiet', '-i', 'pipe:0',
        '-map_metadata', '-1',
        '-c', 'copy',
        '-f', format, 'pipe:1'
      ], { stdio: ['pipe', 'pipe', 'ignore'] });

      ff.on('error', () => done(inputBuffer)); // ffmpeg not found — pass through
      ff.stdout.on('data', (chunk) => chunks.push(chunk));
      ff.on('close', (code) => {
        done(code === 0 && chunks.length > 0 ? Buffer.concat(chunks) : inputBuffer);
      });

      ff.stdin.write(inputBuffer);
      ff.stdin.end();
    } catch {
      done(inputBuffer); // spawn threw — pass through
    }
  });
};

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

// PART 8: Magic byte signatures for video/audio validation
// Client-supplied Content-Type (mimetype) is untrusted — verify actual file content
const MAGIC_BYTE_CHECKS = {
  'video/mp4':       { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp box
  'video/quicktime': { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp box
  'audio/m4a':       { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp box
  'video/webm':      { offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] }, // EBML
  'audio/webm':      { offset: 0, bytes: [0x1A, 0x45, 0xDF, 0xA3] }, // EBML
  'video/ogg':       { offset: 0, bytes: [0x4F, 0x67, 0x67, 0x53] }, // OggS
  'audio/ogg':       { offset: 0, bytes: [0x4F, 0x67, 0x67, 0x53] }, // OggS
  'audio/wav':       { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
};

// MP3 has multiple valid sync word patterns
const MP3_SIGNATURES = [
  [0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2], // MPEG sync words
  [0x49, 0x44, 0x33]                          // ID3 tag
];

// LAYER: SHA-256 hash tracking
// Computes a hash of the raw uploaded bytes, checks against the blocklist,
// then upserts the hash record to track repeat uploads.
const computeAndCheckHash = async (buffer, userId) => {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  const existing = await MediaHash.findOne({ hash });
  if (existing?.flagged) {
    const err = new Error('File rejected: this content has been flagged.');
    err.code = 'FLAGGED_CONTENT';
    throw err;
  }

  // Upsert — track how many times this exact file has been uploaded
  await MediaHash.findOneAndUpdate(
    { hash },
    {
      $inc: { uploadCount: 1 },
      $set: { lastSeenAt: new Date() },
      $setOnInsert: { firstSeenAt: new Date() }
    },
    { upsert: true }
  );

  return hash;
};

// LAYER: Media decodability test via ffprobe
// Validates the file is actually a parseable media container before processing.
// Fails closed only when ffprobe is available — passes through if not installed.
const validateMediaDecodable = (buffer) => {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err) => { if (!settled) { settled = true; err ? reject(err) : resolve(); } };

    try {
      const ff = spawn('ffprobe', [
        '-v', 'error',
        '-i', 'pipe:0',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1'
      ], { stdio: ['pipe', 'ignore', 'pipe'] });

      let stderr = '';
      ff.on('error', () => done()); // ffprobe not installed — pass through
      ff.stderr.on('data', d => { stderr += d.toString(); });
      ff.on('close', code => {
        if (code !== 0 && stderr.length > 0) {
          done(new Error('Media file is malformed or cannot be decoded.'));
        } else {
          done();
        }
      });

      ff.stdin.write(buffer);
      ff.stdin.end();
    } catch {
      done(); // spawn threw — pass through
    }
  });
};

const validateMagicBytes = (buffer, mimetype) => {
  if (!buffer || buffer.length < 12) return false;

  if (mimetype === 'audio/mpeg' || mimetype === 'audio/mp3') {
    return MP3_SIGNATURES.some(sig => sig.every((byte, i) => buffer[i] === byte));
  }

  const check = MAGIC_BYTE_CHECKS[mimetype];
  if (!check) return true; // No known signature — pass through

  const { offset, bytes } = check;
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => buffer[offset + i] === byte);
};

// Init GridFSBucket (modern API)
let gridfsBucket;
mongoose.connection.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
  logger.info('GridFS initialized successfully');
});

/**
 * Delete a file from storage (R2 or GridFS)
 * Handles both full URLs and just filenames
 * @param {string} fileUrl - The file URL or filename to delete
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
export const deleteFromGridFS = async (fileUrl) => {
  try {
    // Extract key from URL if needed
    let key = fileUrl;
    if (fileUrl.includes('/')) {
      key = fileUrl.split('/').pop();
    }

    // Try R2 first if enabled
    if (isR2Enabled()) {
      try {
        await deleteFromR2(key);
        logger.debug('Deleted file from R2', { key });
        return true;
      } catch (r2Error) {
        logger.warn('R2 delete failed, falling back to GridFS', {
          key,
          error: r2Error.message
        });
      }
    }

    // Fallback to GridFS
    if (!gridfsBucket) {
      logger.error('GridFS not initialized during delete', { key });
      return false;
    }

    // Find the file in GridFS
    const files = await gridfsBucket.find({ filename: key }).toArray();

    if (!files || files.length === 0) {
      logger.debug('File not found in GridFS during delete', { key });
      return false;
    }

    // Delete the file
    await gridfsBucket.delete(files[0]._id);
    logger.debug('Deleted file from GridFS', { key });
    return true;
  } catch (error) {
    logger.error('Error deleting file', { fileUrl, error });
    return false;
  }
};

/**
 * Save processed file to storage (R2 or GridFS)
 * Strips EXIF data from images before saving
 * @param {Object} file - Multer file object
 * @param {boolean|Object} generateSizes - Whether to generate responsive sizes, or options object
 */
const saveToGridFS = async (file, generateSizes = false, userId = null) => {
  let buffer = file.buffer;
  let contentType = file.mimetype;
  let sizes = null;

  // ── 1. SHA-256 hash tracking + blocklist check ────────────────────────────
  await computeAndCheckHash(buffer, userId);
  // ─────────────────────────────────────────────────────────────────────────

  // ── 2. Malware scan (provider configurable — currently none) ──────────────
  const { scanFile } = await import('../services/fileScanService.js');
  const scanResult = await scanFile(buffer, file.originalname, userId);
  if (!scanResult.clean && !scanResult.skipped) {
    const err = new Error('File rejected: malware detected.');
    err.code = 'MALWARE_DETECTED';
    throw err;
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── 3. Process and optimize images ───────────────────────────────────────
  // validateImageDimensions rejects bombs (>8000px / >40MP) before Sharp decodes.
  // Sharp re-encodes the image from scratch — destroys any hidden payload.
  if (file.mimetype.startsWith('image/')) {
    if (file.mimetype !== 'image/gif') {
      await validateImageDimensions(buffer);
    }
    logger.debug('Processing and optimizing image', {
      originalName: file.originalname,
      contentType: file.mimetype
    });
    const result = await stripExifData(buffer, file.mimetype, { generateSizes });
    buffer = result.buffer;
    contentType = result.mimetype;
    sizes = result.sizes;
    logger.debug('Image optimized successfully', {
      originalName: file.originalname,
      contentType
    });
  }

  // ── 4. Validate + re-encode video/audio ──────────────────────────────────
  if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
    // Magic byte check — verify file content matches declared MIME type
    if (!validateMagicBytes(buffer, file.mimetype)) {
      throw new Error(`File content does not match declared MIME type: ${file.mimetype}`);
    }
    // Decodability test — rejects malformed containers designed to crash parsers
    await validateMediaDecodable(buffer);
    // Strip metadata via ffmpeg stream copy (no re-encode cost, removes all metadata)
    buffer = await stripAVMetadata(buffer, file.mimetype);
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Update filename extension if converted to WebP
  const timestamp = Date.now();
  // Sanitize originalname: strip path traversal chars, keep only safe chars, cap length
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  let filename = `${timestamp}-${safeName}`;
  if (contentType === 'image/webp' && !filename.endsWith('.webp')) {
    filename = filename.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  }

  // Try R2 first if enabled
  if (isR2Enabled()) {
    try {
      logger.debug('Uploading file to R2', { filename, contentType });
      const r2Result = await uploadToR2(buffer, filename, contentType);

      const result = {
        filename: r2Result.key,
        id: r2Result.key,
        url: r2Result.url
      };

      // Save responsive sizes to R2 if generated
      if (sizes) {
        try {
          const sizeIds = {};
          const baseName = safeName.replace(/\.(jpg|jpeg|png)$/i, '');

          // Helper function to save a size variant to R2
          const saveSizeVariant = async (buf, sizeName, format) => {
            const ext = format === 'avif' ? '.avif' : '.webp';
            const variantKey = `${timestamp}-${sizeName}-${baseName}${ext}`;
            await uploadToR2(buf, variantKey, `image/${format}`);
            return variantKey;
          };

          // Save small size (thumbnail)
          if (sizes.small?.webp) {
            sizeIds.small = {
              webp: await saveSizeVariant(sizes.small.webp, 'small', 'webp')
            };
          }

          // Save medium size (full view)
          if (sizes.medium?.webp) {
            sizeIds.medium = {
              webp: await saveSizeVariant(sizes.medium.webp, 'medium', 'webp')
            };
          }

          result.sizes = sizeIds;
          logger.debug('Saved responsive sizes to R2', {
            filename,
            sizeKeys: Object.keys(sizeIds)
          });
        } catch (sizeError) {
          logger.warn('Failed to save responsive sizes to R2', {
            filename,
            error: sizeError.message
          });
          // Continue without sizes
        }
      }

      logger.debug('File uploaded to R2', {
        filename,
        url: r2Result.url
      });
      return result;
    } catch (r2Error) {
      logger.warn('R2 upload failed, falling back to GridFS', {
        filename,
        error: r2Error.message
      });
    }
  }

  // Fallback to GridFS
  logger.debug('Uploading file to GridFS', { filename, contentType });
  return new Promise((resolve, reject) => {
    const readableStream = Readable.from(buffer);
    const uploadStream = gridfsBucket.openUploadStream(filename, {
      contentType: contentType
    });

    readableStream.pipe(uploadStream);

    uploadStream.on('finish', () => {
      const result = {
        filename: filename,
        id: uploadStream.id
      };

      if (!sizes) {
        resolve(result);
        return;
      }

      // Save responsive sizes if generated (WebP + AVIF formats)
      (async () => {
        try {
          const sizeIds = {};
          const baseName = safeName.replace(/\.(jpg|jpeg|png)$/i, '');

          // Helper function to save a size variant
          const saveSizeVariant = async (buf, sizeName, format) => {
            const ext = format === 'avif' ? '.avif' : '.webp';
            const variantFilename = `${timestamp}-${sizeName}-${baseName}${ext}`;
            const variantStream = Readable.from(buf);
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

          // Save small size (thumbnail)
          if (sizes.small?.webp) {
            sizeIds.small = {
              webp: await saveSizeVariant(sizes.small.webp, 'small', 'webp')
            };
          }

          // Save medium size (full view)
          if (sizes.medium?.webp) {
            sizeIds.medium = {
              webp: await saveSizeVariant(sizes.medium.webp, 'medium', 'webp')
            };
          }

          result.sizes = sizeIds;
          logger.debug('Saved responsive sizes to GridFS', {
            filename,
            sizeKeys: Object.keys(sizeIds)
          });
        } catch (sizeError) {
          logger.warn('Failed to save responsive sizes to GridFS', {
            filename,
            error: sizeError.message
          });
          // Continue without sizes
        }
        resolve(result);
      })();
    });

    uploadStream.on('error', reject);
  });
};

// @route   POST /api/upload/profile-photo
// @desc    Upload profile photo
// @access  Private
router.post('/profile-photo', auth, uploadLimiter, userUploadLimiter, uploadQuotaMiddleware, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    try {
      logger.debug('Profile photo upload request received', { userId: req.userId });

      if (err) {
        logger.warn('Profile photo upload rejected by multer', {
          userId: req.userId,
          code: err.code,
          error: err.message
        });

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
        logger.warn('Profile photo upload missing file', { userId: req.userId });
        return res.status(400).json({
          error: 'No file received',
          message: 'No file uploaded. Please select an image and try again.'
        });
      }

      // Validate it's an image
      if (!req.file.mimetype.startsWith('image/')) {
        logger.warn('Invalid profile photo file type', {
          userId: req.userId,
          contentType: req.file.mimetype
        });
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

      // Use R2 URL if available, otherwise fall back to local path
      const photoUrl = fileInfo.url || `/upload/image/${fileInfo.filename}`;

      // Update user profile photo
      const updatedUser = await User.findByIdAndUpdate(
        req.userId,
        { profilePhoto: photoUrl },
        { new: true }
      );

      logger.info('Profile photo updated successfully', {
        userId: req.userId,
        photoUrl
      });
      res.json({ url: photoUrl, user: updatedUser });
    } catch (error) {
      logger.error('Upload profile photo error', {
        userId: req.userId,
        error
      });
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
router.post('/cover-photo', auth, uploadLimiter, userUploadLimiter, uploadQuotaMiddleware, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    try {
      logger.debug('Cover photo upload request received', { userId: req.userId });

      if (err) {
        logger.warn('Cover photo upload rejected by multer', {
          userId: req.userId,
          code: err.code,
          error: err.message
        });

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
        logger.warn('Cover photo upload missing file', { userId: req.userId });
        return res.status(400).json({
          error: 'No file received',
          message: 'No file uploaded. Please select an image and try again.'
        });
      }

      // Validate it's an image
      if (!req.file.mimetype.startsWith('image/')) {
        logger.warn('Invalid cover photo file type', {
          userId: req.userId,
          contentType: req.file.mimetype
        });
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

      const photoUrl = fileInfo.url || `/upload/image/${fileInfo.filename}`;

      // Update user cover photo
      const updatedUser = await User.findByIdAndUpdate(
        req.userId,
        { coverPhoto: photoUrl },
        { new: true }
      );

      logger.info('Cover photo updated successfully', {
        userId: req.userId,
        photoUrl
      });
      res.json({ url: photoUrl, user: updatedUser });
    } catch (error) {
      logger.error('Upload cover photo error', {
        userId: req.userId,
        error
      });
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
router.post('/chat-attachment', auth, uploadLimiter, userUploadLimiter, uploadQuotaMiddleware, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err) {
        logger.warn('Chat attachment upload rejected by multer', {
          userId: req.userId,
          code: err.code,
          error: err.message
        });

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
        logger.warn('Chat attachment upload missing file', { userId: req.userId });
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

      logger.info('Chat attachment uploaded successfully', {
        userId: req.userId,
        fileUrl
      });
      res.json({ url: fileUrl });
    } catch (error) {
      logger.error('Upload chat attachment error', {
        userId: req.userId,
        error
      });
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
router.post('/post-media', auth, uploadLimiter, userUploadLimiter, uploadQuotaMiddleware, (req, res) => {
  // DIAGNOSTIC: Log middleware chain entry point
  if (config.nodeEnv === 'development') {
    logger.debug('Post media upload request received', {
      userId: req.userId,
      contentType: req.headers['content-type'],
      hasAuthorizationHeader: Boolean(req.headers['authorization']),
      hasLegacyAuthHeader: Boolean(req.headers['x-auth-token']),
      hasCsrfCookie: Boolean(req.cookies?.['XSRF-TOKEN']),
      hasCsrfHeader: Boolean(req.headers['x-xsrf-token'] || req.headers['x-csrf-token'])
    });
  }

  upload.array('media', 3)(req, res, async (err) => {
    try {
      // DIAGNOSTIC: Log multer result
      if (config.nodeEnv === 'development') {
        logger.debug('Post media multer processing complete', {
          userId: req.userId,
          fileCount: req.files?.length || 0
        });
      }

      // Enhanced error handling for multer errors
      if (err) {
        logger.warn('Post media upload rejected by multer', {
          userId: req.userId,
          code: err.code,
          error: err.message
        });

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
        logger.warn('Post media upload missing files', { userId: req.userId });
        return res.status(400).json({
          error: 'No file received',
          message: 'No files uploaded. Please select a file and try again.'
        });
      }

      // Validate file types
      for (const file of req.files) {
        if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
          logger.warn('Invalid post media file type', {
            userId: req.userId,
            contentType: file.mimetype
          });
          return res.status(400).json({
            error: 'Invalid file type',
            message: 'Only images and videos are allowed.',
            detail: `Received: ${file.mimetype}`
          });
        }
      }

      logger.debug('Processing post media files', {
        userId: req.userId,
        fileCount: req.files.length
      });

      // Get draftId from request body (optional - for attaching to existing draft)
      const { draftId } = req.body;

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

        // CRITICAL: Create TempMedia record to track this upload
        // This enables proper cleanup and prevents ghost media on refresh
        try {
          const tempMedia = new TempMedia({
            userId: req.userId,
            filename: fileInfo.filename,
            url,
            type,
            mimetype: file.mimetype,
            fileSize: file.size,
            sizes: fileInfo.sizes ? {
              thumbnail: fileInfo.sizes.thumbnail ? `/upload/file/${fileInfo.sizes.thumbnail}` : null,
              small: fileInfo.sizes.small ? `/upload/file/${fileInfo.sizes.small}` : null,
              medium: fileInfo.sizes.medium ? `/upload/file/${fileInfo.sizes.medium}` : null
            } : undefined,
            status: draftId ? 'attached' : 'temporary',
            ownerType: draftId ? 'draft' : 'none',
            ownerId: draftId || null,
            attachedAt: draftId ? new Date() : null
          });

          await tempMedia.save();

          // Add tempMediaId to result for frontend tracking
          result.tempMediaId = tempMedia._id;

          if (config.nodeEnv === 'development') {
            logger.debug('Created temp media record', {
              tempMediaId: tempMedia._id,
              url,
              status: tempMedia.status,
              ownerType: tempMedia.ownerType,
              ownerId: tempMedia.ownerId || null
            });
          }
        } catch (tempMediaError) {
          // Log but don't fail the upload - temp media tracking is non-critical
          logger.warn('Failed to create temp media tracking record', {
            userId: req.userId,
            error: tempMediaError.message
          });
        }

        return result;
      }));

      logger.info('Post media uploaded successfully', {
        userId: req.userId,
        fileCount: mediaUrls.length,
        draftId: draftId || null
      });
      res.json({ media: mediaUrls });
    } catch (error) {
      logger.error('Upload post media error', {
        userId: req.userId,
        error
      });
      res.status(500).json({
        error: 'Image upload failed',
        message: 'Image upload failed. Please try again or use a smaller image.',
        detail: error.message
      });
    }
  });
});

// @route   DELETE /api/upload/post-media/:mediaId
// @desc    Delete temporary media (before post is published)
// @access  Private
router.delete('/post-media/:mediaId', auth, async (req, res) => {
  try {
    const { mediaId } = req.params;

    if (config.nodeEnv === 'development') {
      logger.debug('Temp media delete requested', {
        mediaId,
        userId: req.userId
      });
    }

    // Find the temp media record
    const tempMedia = await TempMedia.findById(mediaId);

    if (!tempMedia) {
      if (config.nodeEnv === 'development') {
        logger.debug('Temp media not found during delete', { mediaId });
      }
      return res.status(404).json({ message: 'Media not found' });
    }

    // Verify ownership
    if (tempMedia.userId.toString() !== req.userId.toString()) {
      if (config.nodeEnv === 'development') {
        logger.warn('Unauthorized temp media delete attempt', {
          mediaId,
          userId: req.userId,
          ownerUserId: tempMedia.userId.toString()
        });
      }
      return res.status(403).json({ message: 'Not authorized to delete this media' });
    }

    // Don't allow deleting published media
    if (tempMedia.status === 'published') {
      if (config.nodeEnv === 'development') {
        logger.warn('Attempted to delete published temp media', { mediaId });
      }
      return res.status(400).json({ message: 'Cannot delete published media' });
    }

    // Delete the physical file from GridFS
    const mainFileDeleted = await deleteFromGridFS(tempMedia.url);

    if (config.nodeEnv === 'development') {
      logger.debug('Temp media main file delete completed', {
        mediaId,
        deleted: mainFileDeleted
      });
    }

    // Delete responsive size files if they exist
    if (tempMedia.sizes) {
      const sizesToDelete = [];

      if (tempMedia.sizes.thumbnail) sizesToDelete.push(tempMedia.sizes.thumbnail);
      if (tempMedia.sizes.small) sizesToDelete.push(tempMedia.sizes.small);
      if (tempMedia.sizes.medium) sizesToDelete.push(tempMedia.sizes.medium);

      // Avatar/feed format sizes
      if (tempMedia.sizes.avatar?.webp) sizesToDelete.push(tempMedia.sizes.avatar.webp);
      if (tempMedia.sizes.avatar?.avif) sizesToDelete.push(tempMedia.sizes.avatar.avif);
      if (tempMedia.sizes.feed?.webp) sizesToDelete.push(tempMedia.sizes.feed.webp);
      if (tempMedia.sizes.feed?.avif) sizesToDelete.push(tempMedia.sizes.feed.avif);
      if (tempMedia.sizes.full?.webp) sizesToDelete.push(tempMedia.sizes.full.webp);
      if (tempMedia.sizes.full?.avif) sizesToDelete.push(tempMedia.sizes.full.avif);

      for (const sizeUrl of sizesToDelete) {
        if (sizeUrl) {
          await deleteFromGridFS(sizeUrl);
        }
      }

      if (config.nodeEnv === 'development') {
        logger.debug('Deleted temp media responsive sizes', {
          mediaId,
          sizeCount: sizesToDelete.length
        });
      }
    }

    // Delete the temp media record
    await tempMedia.deleteOne();

    if (config.nodeEnv === 'development') {
      logger.debug('Temp media deleted successfully', { mediaId });
    }

    res.json({
      message: 'Media deleted successfully',
      deleted: true,
      mediaId
    });

  } catch (error) {
    logger.error('Temp media delete error', {
      mediaId: req.params.mediaId,
      userId: req.userId,
      error
    });
    res.status(500).json({
      message: 'Failed to delete media',
      error: error.message
    });
  }
});

// @route   DELETE /api/upload/post-media/by-url
// @desc    Delete temporary media by URL (fallback for older uploads without tempMediaId)
// @access  Private
router.delete('/post-media/by-url', auth, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    if (config.nodeEnv === 'development') {
      logger.debug('Temp media delete-by-url requested', {
        url,
        userId: req.userId
      });
    }

    // Find the temp media record by URL
    const tempMedia = await TempMedia.findOne({ url, userId: req.userId });

    if (!tempMedia) {
      // Try to delete directly from GridFS even if no record exists
      // This handles legacy uploads before TempMedia tracking
      const deleted = await deleteFromGridFS(url);

      if (deleted) {
        if (config.nodeEnv === 'development') {
          logger.debug('Deleted legacy temp media by URL', {
            url,
            userId: req.userId
          });
        }
        return res.json({
          message: 'Media deleted successfully (legacy)',
          deleted: true
        });
      }

      if (config.nodeEnv === 'development') {
        logger.debug('Temp media not found during delete-by-url', {
          url,
          userId: req.userId
        });
      }
      return res.status(404).json({ message: 'Media not found' });
    }

    // Don't allow deleting published media
    if (tempMedia.status === 'published') {
      return res.status(400).json({ message: 'Cannot delete published media' });
    }

    // Delete the physical file from GridFS
    await deleteFromGridFS(tempMedia.url);

    // Delete responsive sizes
    if (tempMedia.sizes) {
      const sizesToDelete = [
        tempMedia.sizes.thumbnail,
        tempMedia.sizes.small,
        tempMedia.sizes.medium,
        tempMedia.sizes.avatar?.webp,
        tempMedia.sizes.avatar?.avif,
        tempMedia.sizes.feed?.webp,
        tempMedia.sizes.feed?.avif,
        tempMedia.sizes.full?.webp,
        tempMedia.sizes.full?.avif
      ].filter(Boolean);

      for (const sizeUrl of sizesToDelete) {
        await deleteFromGridFS(sizeUrl);
      }
    }

    // Delete the temp media record
    await tempMedia.deleteOne();

    if (config.nodeEnv === 'development') {
      logger.debug('Temp media deleted by URL successfully', {
        url,
        userId: req.userId
      });
    }

    res.json({
      message: 'Media deleted successfully',
      deleted: true
    });

  } catch (error) {
    logger.error('Temp media delete-by-url error', {
      url: req.body?.url,
      userId: req.userId,
      error
    });
    res.status(500).json({
      message: 'Failed to delete media',
      error: error.message
    });
  }
});

// Helper: set standard media response headers
const setMediaHeaders = (res, contentType) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Content-Type', contentType);
  res.set('Cache-Control', 'public, max-age=31536000');
};

// Helper: try to serve a key from R2, returns true if served
const tryServeFromR2 = async (key, res) => {
  if (!isR2Enabled()) return false;
  try {
    const { stream, contentType } = await getObjectStream(key);
    setMediaHeaders(res, contentType);
    stream.pipe(res);
    return true;
  } catch {
    return false;
  }
};

// @route   GET /api/upload/image/:filename
// @desc    Get image — serves from GridFS or R2
// @access  Public
router.get('/image/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);

    // 1. Try GridFS first (legacy storage)
    if (gridfsBucket) {
      const files = await gridfsBucket.find({ filename }).toArray();
      if (files && files.length > 0) {
        const file = files[0];
        const imageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
        if (!imageTypes.includes(file.contentType)) {
          return res.status(404).json({ message: 'Not an image' });
        }
        setMediaHeaders(res, file.contentType);
        gridfsBucket.openDownloadStreamByName(filename).pipe(res);
        return;
      }
    }

    // 2. Fallback to R2
    if (await tryServeFromR2(filename, res)) return;

    res.status(404).json({ message: 'File not found' });
  } catch (error) {
    logger.error('Get image error', {
      filename: req.params.filename,
      error
    });
    res.status(500).json({ message: 'Error retrieving image' });
  }
});

// @route   GET /api/upload/file/:filename
// @desc    Get any file (image, video, gif) — serves from GridFS or R2
// @access  Public
router.get('/file/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);

    // 1. Try GridFS first (legacy storage)
    if (gridfsBucket) {
      const files = await gridfsBucket.find({ filename }).toArray();
      if (files && files.length > 0) {
        setMediaHeaders(res, files[0].contentType);
        gridfsBucket.openDownloadStreamByName(filename).pipe(res);
        return;
      }
    }

    // 2. Fallback to R2
    if (await tryServeFromR2(filename, res)) return;

    res.status(404).json({ message: 'File not found' });
  } catch (error) {
    logger.error('Get file error', {
      filename: req.params.filename,
      error
    });
    res.status(500).json({ message: 'Error retrieving file' });
  }
});

// @route   POST /api/upload/voice-note
// @desc    Upload voice note (audio file)
// @access  Private
router.post('/voice-note', auth, uploadLimiter, userUploadLimiter, uploadQuotaMiddleware, (req, res) => {
  upload.single('audio')(req, res, async (err) => {
    try {
      if (err) {
        logger.warn('Voice note upload rejected by multer', {
          userId: req.userId,
          code: err.code,
          error: err.message
        });
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
      logger.error('Upload voice note error', {
        userId: req.userId,
        error
      });
      res.status(500).json({ message: 'Server error' });
    }
  });
});

export default router;
