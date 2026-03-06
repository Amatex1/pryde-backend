/**
 * Cloudflare R2 Storage Service
 * 
 * Provides S3-compatible storage for media files.
 * Falls back to GridFS if R2 is not configured.
 * 
 * Environment Variables Required:
 * - R2_ENABLED=true
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME
 * - R2_PUBLIC_URL (optional, for CDN)
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config/config.js';
import logger from './logger.js';

let s3Client = null;
let useR2 = false;

/**
 * Initialize R2/S3 client
 */
export const initR2 = async () => {
  const { r2 } = config;
  
  if (!r2 || !r2.enabled) {
    logger.warn('[R2Storage] R2 not enabled - using GridFS fallback');
    return false;
  }

  if (!r2.accountId || !r2.accessKeyId || !r2.secretAccessKey) {
    logger.warn('[R2Storage] R2 credentials not configured - using GridFS fallback');
    return false;
  }

  try {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
      },
    });

    useR2 = true;
    logger.info('[R2Storage] R2 client initialized successfully');
    return true;
  } catch (error) {
    logger.error('[R2Storage] Failed to initialize R2 client:', error.message);
    return false;
  }
};

/**
 * Upload a file to R2 with CDN-optimized headers
 * @param {Buffer} buffer - File buffer
 * @param {string} key - Object key (filename)
 * @param {string} contentType - MIME type
 * @returns {Promise<{key: string, url: string}>}
 */
export const uploadToR2 = async (buffer, key, contentType) => {
  if (!useR2 || !s3Client) {
    throw new Error('R2 not initialized');
  }

  const { r2 } = config;
  
  const command = new PutObjectCommand({
    Bucket: r2.bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // CDN Cache Headers - cache for 1 year, immutable
    CacheControl: 'public, max-age=31536000, immutable',
  });

  await s3Client.send(command);

  // Generate public URL using CDN base if configured
  const url = r2.publicUrl 
    ? `${r2.publicUrl}/${key}`
    : `https://${r2.bucketName}.${r2.accountId}.r2.cloudflarestorage.com/${key}`;

  return { key, url };
};

/**
 * Get a signed URL for private objects (if needed)
 * @param {string} key - Object key
 * @param {number} expiresIn - URL expiry in seconds
 * @returns {Promise<string>}
 */
export const getSignedDownloadUrl = async (key, expiresIn = 3600) => {
  if (!useR2 || !s3Client) {
    throw new Error('R2 not initialized');
  }

  const { r2 } = config;
  
  const command = new GetObjectCommand({
    Bucket: r2.bucketName,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
};

/**
 * Delete a file from R2
 * @param {string} key - Object key
 * @returns {Promise<boolean>}
 */
export const deleteFromR2 = async (key) => {
  if (!useR2 || !s3Client) {
    throw new Error('R2 not initialized');
  }

  const { r2 } = config;
  
  const command = new DeleteObjectCommand({
    Bucket: r2.bucketName,
    Key: key,
  });

  await s3Client.send(command);
  return true;
};

/**
 * Get public URL for a file (uses CDN if configured)
 * @param {string} key - Object key
 * @returns {string}
 */
export const getPublicUrl = (key) => {
  const { r2 } = config;
  
  // Use custom CDN URL if configured
  if (r2 && r2.publicUrl) {
    return `${r2.publicUrl}/${key}`;
  }
  
  // Use R2 direct URL
  if (r2 && r2.accountId) {
    return `https://${r2.bucketName}.${r2.accountId}.r2.cloudflarestorage.com/${key}`;
  }
  
  // Fallback to local URL
  return `/upload/file/${key}`;
};

/**
 * Check if R2 is available
 * @returns {boolean}
 */
export const isR2Enabled = () => useR2;

/**
 * Generate a unique key for uploads
 * @param {string} originalName - Original filename
 * @returns {string}
 */
export const generateUploadKey = (originalName) => {
  const timestamp = Date.now();
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `uploads/${timestamp}-${sanitizedName}`;
};

export default {
  initR2,
  uploadToR2,
  getSignedDownloadUrl,
  deleteFromR2,
  getPublicUrl,
  isR2Enabled,
  generateUploadKey,
};
