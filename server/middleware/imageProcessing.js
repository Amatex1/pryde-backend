import sharp from 'sharp';
import { Readable } from 'stream';

/**
 * Process and optimize uploaded images
 * - Strips EXIF data for privacy
 * - Converts to WebP for better compression
 * - Resizes large images to reasonable dimensions
 * - Compresses images to reduce file size
 * - Generates multiple sizes for responsive images
 *
 * @param {Buffer} imageBuffer - The image buffer to process
 * @param {string} mimetype - The image MIME type
 * @param {Object} options - Processing options
 * @param {number} options.maxWidth - Maximum width (default: 2048)
 * @param {number} options.maxHeight - Maximum height (default: 2048)
 * @param {number} options.quality - WebP quality 1-100 (default: 85)
 * @param {boolean} options.convertToWebP - Convert to WebP (default: true)
 * @param {boolean} options.generateSizes - Generate multiple sizes (default: false)
 * @returns {Promise<{buffer: Buffer, mimetype: string, sizes?: Object}>} - Processed image buffer and new mimetype
 */
export const stripExifData = async (imageBuffer, mimetype, options = {}) => {
  try {
    // Only process images, not videos
    if (!mimetype.startsWith('image/')) {
      return { buffer: imageBuffer, mimetype };
    }

    // Default options
    const {
      maxWidth = 2048,
      maxHeight = 2048,
      quality = 85,
      convertToWebP = true,
      generateSizes = false
    } = options;

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`📸 Processing image: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

    // Start Sharp pipeline
    let pipeline = sharp(imageBuffer)
      .rotate(); // Auto-rotate based on EXIF orientation

    // Resize if image is too large
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      console.log(`📏 Resizing from ${metadata.width}x${metadata.height} to max ${maxWidth}x${maxHeight}`);
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to WebP for better compression (unless it's a GIF)
    let newMimetype = mimetype;
    if (convertToWebP && mimetype !== 'image/gif') {
      console.log(`🔄 Converting to WebP (quality: ${quality})`);
      pipeline = pipeline.webp({ quality });
      newMimetype = 'image/webp';
    } else if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
      // If keeping JPEG, compress it
      pipeline = pipeline.jpeg({ quality });
    } else if (mimetype === 'image/png') {
      // If keeping PNG, compress it
      pipeline = pipeline.png({ quality: Math.round(quality / 10), compressionLevel: 9 });
    }

    // Remove all metadata (EXIF, ICC, IPTC, XMP)
    const processedBuffer = await pipeline
      .withMetadata({
        exif: {},
        icc: undefined,
        iptc: undefined,
        xmp: undefined
      })
      .toBuffer();

    const originalSize = imageBuffer.length;
    const newSize = processedBuffer.length;
    const savings = Math.round((1 - newSize / originalSize) * 100);

    console.log(`✅ Image optimized: ${Math.round(originalSize / 1024)}KB → ${Math.round(newSize / 1024)}KB (${savings}% smaller)`);

    // Generate multiple sizes if requested (for responsive images)
    let sizes = null;
    if (generateSizes && mimetype !== 'image/gif') {
      console.log('📐 Generating responsive image sizes...');
      // Pass through options to control size generation (e.g., isAvatar)
      const sizeOptions = typeof generateSizes === 'object' ? generateSizes : {};
      sizes = await generateResponsiveSizes(imageBuffer, newMimetype, quality, sizeOptions);
    }

    return { buffer: processedBuffer, mimetype: newMimetype, sizes };
  } catch (error) {
    console.error('❌ Error processing image:', error);
    // If processing fails, return original buffer
    return { buffer: imageBuffer, mimetype };
  }
};

/**
 * Generate multiple sizes and formats of an image for responsive loading
 * @param {Buffer} imageBuffer - The image buffer
 * @param {string} mimetype - The target mimetype (should be image/webp)
 * @param {number} quality - Image quality
 * @param {Object} options - Size generation options
 * @param {boolean} options.isAvatar - Whether this is an avatar/profile photo (generates smaller sizes)
 * @returns {Promise<Object>} - Object with avatar/feed/full sizes in WebP and AVIF formats
 */
export const generateResponsiveSizes = async (imageBuffer, mimetype, quality = 85, options = {}) => {
  try {
    const { isAvatar = false } = options;

    // Define sizes based on use case
    // Avatar: 32-64px for tiny avatars, 300-600px for feed, full for profile view
    // Post: 300-600px for feed, full for expanded view
    const sizes = isAvatar ? {
      avatar: 48,      // Tiny avatar for lists/comments (32-64px range)
      feed: 400,       // Feed display (300-600px range)
      full: 1200       // Full profile view (capped at 1200px)
    } : {
      avatar: null,    // Posts don't need tiny avatar size
      feed: 600,       // Feed display (300-600px range)
      full: 1600       // Full view for posts (capped at 1600px)
    };

    const result = {};

    // Generate avatar size (only for profile photos)
    if (isAvatar) {
      // WebP version
      const avatarWebP = await sharp(imageBuffer)
        .resize(sizes.avatar, sizes.avatar, { fit: 'cover', position: 'center' })
        .webp({ quality: 80 })
        .toBuffer();

      // AVIF version (50% better compression than WebP)
      const avatarAVIF = await sharp(imageBuffer)
        .resize(sizes.avatar, sizes.avatar, { fit: 'cover', position: 'center' })
        .avif({ quality: 75 })
        .toBuffer();

      result.avatar = {
        webp: avatarWebP,
        avif: avatarAVIF
      };

      console.log(`✅ Avatar size: WebP (${Math.round(avatarWebP.length / 1024)}KB), AVIF (${Math.round(avatarAVIF.length / 1024)}KB)`);
    }

    // Generate feed size
    const feedWebP = await sharp(imageBuffer)
      .resize(sizes.feed, isAvatar ? sizes.feed : null, {
        fit: isAvatar ? 'cover' : 'inside',
        position: 'center',
        withoutEnlargement: true
      })
      .webp({ quality: 85 })
      .toBuffer();

    const feedAVIF = await sharp(imageBuffer)
      .resize(sizes.feed, isAvatar ? sizes.feed : null, {
        fit: isAvatar ? 'cover' : 'inside',
        position: 'center',
        withoutEnlargement: true
      })
      .avif({ quality: 80 })
      .toBuffer();

    result.feed = {
      webp: feedWebP,
      avif: feedAVIF
    };

    console.log(`✅ Feed size: WebP (${Math.round(feedWebP.length / 1024)}KB), AVIF (${Math.round(feedAVIF.length / 1024)}KB)`);

    // Generate full size
    const fullWebP = await sharp(imageBuffer)
      .resize(sizes.full, sizes.full, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality })
      .toBuffer();

    const fullAVIF = await sharp(imageBuffer)
      .resize(sizes.full, sizes.full, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .avif({ quality: quality - 5 })
      .toBuffer();

    result.full = {
      webp: fullWebP,
      avif: fullAVIF
    };

    console.log(`✅ Full size: WebP (${Math.round(fullWebP.length / 1024)}KB), AVIF (${Math.round(fullAVIF.length / 1024)}KB)`);

    return result;
  } catch (error) {
    console.error('❌ Error generating responsive sizes:', error);
    return null;
  }
};

/**
 * Middleware to process uploaded images
 * - Strips EXIF data
 * - Converts to WebP
 * - Compresses and resizes
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

    console.log('🔒 Processing and optimizing image...');

    // Get the file buffer
    const originalBuffer = req.file.buffer;

    // Process image (strip EXIF, convert to WebP, compress)
    const { buffer: processedBuffer, mimetype: newMimetype } = await stripExifData(
      originalBuffer,
      req.file.mimetype
    );

    // Replace the buffer and mimetype with processed version
    req.file.buffer = processedBuffer;
    req.file.size = processedBuffer.length;
    req.file.mimetype = newMimetype;

    console.log('✅ Image processed successfully');
    next();
  } catch (error) {
    console.error('❌ Error in image processing middleware:', error);
    // Continue even if processing fails
    next();
  }
};

/**
 * Process image stream from GridFS
 * - Strips EXIF data
 * - Converts to WebP
 * - Compresses and resizes
 * Used when retrieving images from database
 *
 * @param {Stream} imageStream - The image stream from GridFS
 * @param {string} mimetype - The image MIME type
 * @returns {Promise<{stream: Stream, mimetype: string}>} - Processed image stream and new mimetype
 */
export const processImageStream = async (imageStream, mimetype) => {
  try {
    // Only process images
    if (!mimetype.startsWith('image/')) {
      return { stream: imageStream, mimetype };
    }

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of imageStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Process image
    const { buffer: processedBuffer, mimetype: newMimetype } = await stripExifData(buffer, mimetype);

    // Convert back to stream
    return { stream: Readable.from(processedBuffer), mimetype: newMimetype };
  } catch (error) {
    console.error('❌ Error processing image stream:', error);
    return { stream: imageStream, mimetype };
  }
};

export default {
  stripExifData,
  processUploadedImage,
  processImageStream
};

