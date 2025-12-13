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
 * Generate multiple sizes of an image for responsive loading
 * @param {Buffer} imageBuffer - The image buffer
 * @param {string} mimetype - The target mimetype (should be image/webp)
 * @param {number} quality - Image quality
 * @param {Object} options - Size generation options
 * @param {boolean} options.isAvatar - Whether this is an avatar/profile photo (generates smaller sizes)
 * @returns {Promise<Object>} - Object with thumbnail, small, medium buffers
 */
export const generateResponsiveSizes = async (imageBuffer, mimetype, quality = 85, options = {}) => {
  try {
    const isWebP = mimetype === 'image/webp';
    const { isAvatar = false } = options;

    // For avatars, use smaller sizes since they're displayed small in feeds
    // For posts, use larger sizes for better quality when expanded
    const sizes = isAvatar ? {
      thumbnail: 64,   // Tiny avatar for lists/comments
      small: 150,      // Standard avatar size
      medium: 300      // Large avatar for profile pages
    } : {
      thumbnail: 150,  // Small preview
      small: 400,      // Mobile/small screens
      medium: 800      // Tablet/desktop
    };

    // Generate thumbnail
    const thumbnail = await sharp(imageBuffer)
      .resize(sizes.thumbnail, sizes.thumbnail, { fit: 'cover', position: 'center' })
      [isWebP ? 'webp' : 'jpeg']({ quality: isAvatar ? 80 : quality })
      .toBuffer();

    // Generate small
    const small = await sharp(imageBuffer)
      .resize(sizes.small, isAvatar ? sizes.small : null, {
        fit: isAvatar ? 'cover' : 'inside',
        position: 'center',
        withoutEnlargement: true
      })
      [isWebP ? 'webp' : 'jpeg']({ quality: isAvatar ? 85 : quality })
      .toBuffer();

    // Generate medium
    const medium = await sharp(imageBuffer)
      .resize(sizes.medium, isAvatar ? sizes.medium : null, {
        fit: isAvatar ? 'cover' : 'inside',
        position: 'center',
        withoutEnlargement: true
      })
      [isWebP ? 'webp' : 'jpeg']({ quality })
      .toBuffer();

    console.log(`✅ Generated ${isAvatar ? 'avatar' : 'post'} sizes: thumbnail (${Math.round(thumbnail.length / 1024)}KB), small (${Math.round(small.length / 1024)}KB), medium (${Math.round(medium.length / 1024)}KB)`);

    return { thumbnail, small, medium };
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

