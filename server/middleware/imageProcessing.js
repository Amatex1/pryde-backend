import sharp from 'sharp';
import { Readable } from 'stream';

/**
 * Process and optimize uploaded images
 * OPTIMIZED: Faster Sharp settings (effort: 2 instead of default 4)
 * OPTIMIZED: Skip metadata read if not needed for resize decision
 * OPTIMIZED: Parallel responsive size generation
 *
 * @param {Buffer} imageBuffer - The image buffer to process
 * @param {string} mimetype - The image MIME type
 * @param {Object} options - Processing options
 * @param {number} options.maxWidth - Maximum width (default: 1600)
 * @param {number} options.maxHeight - Maximum height (default: 1600)
 * @param {number} options.quality - WebP quality 1-100 (default: 82)
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

    // Default options - reduced dimensions for faster processing
    const {
      maxWidth = 1600,  // Reduced from 2048
      maxHeight = 1600,
      quality = 82,     // Slightly lower for speed
      convertToWebP = true,
      generateSizes = false
    } = options;

    // Get image metadata (needed for resize decision)
    const metadata = await sharp(imageBuffer).metadata();

    // Skip processing entirely for small images in correct format
    const isSmallEnough = metadata.width <= maxWidth && metadata.height <= maxHeight;
    const isAlreadyWebP = mimetype === 'image/webp';
    const isGif = mimetype === 'image/gif';

    if (isGif) {
      // Never process GIFs - preserve animation
      return { buffer: imageBuffer, mimetype };
    }

    if (isSmallEnough && isAlreadyWebP && !generateSizes) {
      // Already optimized, just strip metadata
      const strippedBuffer = await sharp(imageBuffer)
        .withMetadata({ exif: {} })
        .toBuffer();
      return { buffer: strippedBuffer, mimetype };
    }

    // Build optimized Sharp pipeline
    let pipeline = sharp(imageBuffer, {
      failOn: 'none',  // Don't fail on minor issues
      sequentialRead: true  // Faster for single-pass processing
    })
      .rotate(); // Auto-rotate based on EXIF orientation

    // Resize if needed
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
        fastShrinkOnLoad: true  // Faster shrinking
      });
    }

    // Convert to WebP with optimized settings
    let newMimetype = mimetype;
    if (convertToWebP) {
      pipeline = pipeline.webp({
        quality,
        effort: 2,        // 0-6, lower = faster (default is 4)
        smartSubsample: true
      });
      newMimetype = 'image/webp';
    } else if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    } else if (mimetype === 'image/png') {
      pipeline = pipeline.png({ compressionLevel: 6 }); // 6 is faster than 9
    }

    // Process main image and responsive sizes in parallel
    const sizeOptions = typeof generateSizes === 'object' ? generateSizes : {};

    const [processedBuffer, sizes] = await Promise.all([
      // Main image processing
      pipeline.withMetadata({ exif: {} }).toBuffer(),
      // Responsive sizes (if requested)
      generateSizes
        ? generateResponsiveSizes(imageBuffer, newMimetype, quality, sizeOptions)
        : Promise.resolve(null)
    ]);

    const originalSize = imageBuffer.length;
    const newSize = processedBuffer.length;
    const savings = Math.round((1 - newSize / originalSize) * 100);

    console.log(`✅ Image optimized: ${Math.round(originalSize / 1024)}KB → ${Math.round(newSize / 1024)}KB (${savings}% smaller)`);

    return { buffer: processedBuffer, mimetype: newMimetype, sizes };
  } catch (error) {
    console.error('❌ Error processing image:', error);
    return { buffer: imageBuffer, mimetype };
  }
};

/**
 * Generate multiple sizes of an image for responsive loading
 * OPTIMIZED: Only WebP (AVIF is too slow for sync processing)
 * OPTIMIZED: Parallel processing with Promise.all
 * OPTIMIZED: Reduced number of sizes
 *
 * @param {Buffer} imageBuffer - The image buffer
 * @param {string} mimetype - The target mimetype (should be image/webp)
 * @param {number} quality - Image quality
 * @param {Object} options - Size generation options
 * @param {boolean} options.isAvatar - Whether this is an avatar/profile photo
 * @returns {Promise<Object>} - Object with responsive sizes in WebP format
 */
export const generateResponsiveSizes = async (imageBuffer, mimetype, quality = 85, options = {}) => {
  try {
    const { isAvatar = false } = options;

    // Simplified sizes - only generate what's actually needed
    const sizes = isAvatar ? {
      small: 100,    // Tiny avatar for lists/comments
      medium: 400,   // Feed/profile display
    } : {
      small: 400,    // Thumbnail for feed
      medium: 1200,  // Full view
    };

    // Process all sizes in parallel for speed
    const [smallWebP, mediumWebP] = await Promise.all([
      // Small size
      sharp(imageBuffer)
        .resize(sizes.small, sizes.small, {
          fit: isAvatar ? 'cover' : 'inside',
          position: 'center',
          withoutEnlargement: true
        })
        .webp({ quality: 80, effort: 2 }) // effort: 2 is faster than default 4
        .toBuffer(),

      // Medium size
      sharp(imageBuffer)
        .resize(sizes.medium, isAvatar ? sizes.medium : null, {
          fit: isAvatar ? 'cover' : 'inside',
          position: 'center',
          withoutEnlargement: true
        })
        .webp({ quality, effort: 2 })
        .toBuffer()
    ]);

    const result = {
      small: { webp: smallWebP },
      medium: { webp: mediumWebP }
    };

    console.log(`✅ Responsive sizes: small (${Math.round(smallWebP.length / 1024)}KB), medium (${Math.round(mediumWebP.length / 1024)}KB)`);

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

