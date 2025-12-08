import sharp from 'sharp';
import { Readable } from 'stream';

/**
 * Strip EXIF data from images to protect user privacy
 * Removes GPS location, camera info, and other metadata
 * 
 * @param {Buffer} imageBuffer - The image buffer to process
 * @param {string} mimetype - The image MIME type
 * @returns {Promise<Buffer>} - Processed image buffer without EXIF data
 */
export const stripExifData = async (imageBuffer, mimetype) => {
  try {
    // Only process images, not videos
    if (!mimetype.startsWith('image/')) {
      return imageBuffer;
    }

    // Use Sharp to process the image and remove all metadata
    const processedBuffer = await sharp(imageBuffer)
      .rotate() // Auto-rotate based on EXIF orientation, then remove EXIF
      .withMetadata({
        // Remove all EXIF data
        exif: {},
        icc: undefined,
        iptc: undefined,
        xmp: undefined
      })
      .toBuffer();

    console.log('✅ EXIF data stripped from image');
    return processedBuffer;
  } catch (error) {
    console.error('❌ Error stripping EXIF data:', error);
    // If processing fails, return original buffer
    // Better to upload with EXIF than fail the upload
    return imageBuffer;
  }
};

/**
 * Middleware to process uploaded images and strip EXIF data
 * Works with multer file uploads
 */
export const processUploadedImage = async (req, res, next) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return next();
    }

    // Only process images
    if (!req.file.mimetype.startsWith('image/')) {
      return next();
    }

    console.log('🔒 Processing image to strip EXIF data...');

    // Get the file buffer
    const originalBuffer = req.file.buffer;

    // Strip EXIF data
    const processedBuffer = await stripExifData(originalBuffer, req.file.mimetype);

    // Replace the buffer with processed version
    req.file.buffer = processedBuffer;
    req.file.size = processedBuffer.length;

    console.log('✅ Image processed successfully');
    next();
  } catch (error) {
    console.error('❌ Error in image processing middleware:', error);
    // Continue even if processing fails
    next();
  }
};

/**
 * Process image stream from GridFS and strip EXIF data
 * Used when retrieving images from database
 * 
 * @param {Stream} imageStream - The image stream from GridFS
 * @param {string} mimetype - The image MIME type
 * @returns {Promise<Buffer>} - Processed image buffer
 */
export const processImageStream = async (imageStream, mimetype) => {
  try {
    // Only process images
    if (!mimetype.startsWith('image/')) {
      return imageStream;
    }

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of imageStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Strip EXIF data
    const processedBuffer = await stripExifData(buffer, mimetype);

    // Convert back to stream
    return Readable.from(processedBuffer);
  } catch (error) {
    console.error('❌ Error processing image stream:', error);
    return imageStream;
  }
};

export default {
  stripExifData,
  processUploadedImage,
  processImageStream
};

