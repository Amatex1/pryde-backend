import crypto from 'crypto';
import logger from './logger.js';

/**
 * Recovery Data Encryption Utility
 *
 * Uses AES-256-GCM for authenticated encryption of sensitive recovery data.
 * This ensures that even if the database is compromised, original user data
 * cannot be recovered without the encryption key.
 */

// Get encryption key from environment (32 bytes hex encoded)
const getEncryptionKey = () => {
  const key = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!key) {
    // Development fallback - NOT for production
    if (process.env.NODE_ENV === 'development') {
      return Buffer.from('dev-key-32-bytes-for-testing-only!', 'utf8');
    }
    throw new Error('MESSAGE_ENCRYPTION_KEY environment variable is required');
  }

  // Convert hex string to buffer (64 hex chars = 32 bytes)
  if (key.length !== 64) {
    throw new Error('MESSAGE_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(key, 'hex');
};

/**
 * Encrypt an object using AES-256-GCM
 * @param {Object} obj - Object to encrypt
 * @returns {Object} Encrypted blob with iv, authTag, and encryptedData
 */
export function encryptObject(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('encryptObject requires a valid object');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16); // 128-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const jsonString = JSON.stringify(obj);
  let encrypted = cipher.update(jsonString, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag(); // 128-bit authentication tag

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encryptedData: encrypted
  };
}

/**
 * Decrypt an encrypted blob back to object
 * @param {Object} encryptedBlob - { iv, authTag, encryptedData }
 * @returns {Object} Decrypted object
 */
export function decryptObject(encryptedBlob) {
  if (!encryptedBlob || typeof encryptedBlob !== 'object') {
    throw new Error('decryptObject requires a valid encrypted blob');
  }

  const { iv, authTag, encryptedData } = encryptedBlob;

  if (!iv || !authTag || !encryptedData) {
    throw new Error('Invalid encrypted blob structure');
  }

  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));

    // Set the authentication tag
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    // Handle backward compatibility: if decryption fails, assume it's plain text
    // This allows migration from unencrypted to encrypted data
    if (typeof encryptedBlob === 'object' && !encryptedBlob.encryptedData) {
      // This looks like plain object data, return as-is
      return encryptedBlob;
    }
    throw new Error('Failed to decrypt data: ' + error.message);
  }
}

/**
 * Check if data appears to be encrypted
 * @param {*} data - Data to check
 * @returns {boolean} True if data looks encrypted
 */
export function isEncrypted(data) {
  // Check for full encrypted object format
  if (data &&
      typeof data === 'object' &&
      data.iv &&
      data.authTag &&
      data.encryptedData) {
    return true;
  }

  // Check if it's a string that looks like encrypted data (hex string of significant length)
  // Raw encrypted strings from MongoDB are long hex strings (IV + AuthTag + Ciphertext)
  if (typeof data === 'string' && data.length > 64 && /^[a-f0-9]+$/i.test(data)) {
    return true;
  }

  return false;
}

/**
 * Encrypt a string message using AES-256-GCM
 * @param {string} message - Message to encrypt
 * @returns {string} Concatenated hex string: IV (32 chars) + authTag (32 chars) + encryptedData
 */
export function encryptMessage(message) {
  if (typeof message !== 'string') {
    throw new Error('encryptMessage requires a string');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16); // 128-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(message, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag(); // 128-bit authentication tag

  // Return concatenated hex string: IV + authTag + encryptedData
  // This ensures proper storage in MongoDB String fields
  return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

/**
 * Decrypt an encrypted message back to string
 * @param {Object|string} encryptedBlob - { iv, authTag, encryptedData } or raw encrypted string
 * @returns {string} Decrypted message
 */
export function decryptMessage(encryptedBlob) {
  // Handle null/undefined
  if (!encryptedBlob) {
    return '';
  }

  // Handle string format (raw encrypted data without metadata)
  if (typeof encryptedBlob === 'string') {
    // Check if it's a JSON string (old messages might be stringified objects)
    if (encryptedBlob.startsWith('{') && encryptedBlob.includes('"iv"')) {
      try {
        const parsed = JSON.parse(encryptedBlob);
        if (parsed.iv && parsed.authTag && parsed.encryptedData) {
          logger.debug('Detected JSON stringified object format in decryptMessage, parsing');
          return decryptMessage(parsed); // Recursively call with parsed object
        }
      } catch (e) {
        logger.warn('Failed to parse JSON string in decryptMessage:', e.message);
      }
    }

    // If it looks like a hex string, try to decrypt it
    if (encryptedBlob.length > 64 && /^[a-f0-9]+$/i.test(encryptedBlob)) {
      const key = getEncryptionKey();

      // Try NEW format first: IV (32 hex chars) + AuthTag (32 hex chars) + Ciphertext
      // Minimum length: 64 chars (IV + AuthTag) + at least some ciphertext
      if (encryptedBlob.length >= 66) {
        try {
          const ivHex = encryptedBlob.substring(0, 32);
          const authTagHex = encryptedBlob.substring(32, 64);
          const encryptedData = encryptedBlob.substring(64);

          const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
          decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

          let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
          decrypted += decipher.final('utf8');

          logger.debug('Decrypted message using new format (IV+AuthTag+Data)');
          return decrypted;
        } catch (e) {
          logger.debug('New format decryption failed, trying old format');
        }
      }

      // Try OLD format: Salt (128 hex chars) + IV (32 hex chars) + AuthTag (32 hex chars) + Ciphertext
      // Minimum length: 192 chars (Salt + IV + AuthTag) + at least some ciphertext
      if (encryptedBlob.length >= 194) {
        try {
          const data = Buffer.from(encryptedBlob, 'hex');

          // Extract components (OLD format from commit 377046e)
          const SALT_LENGTH = 64;  // 64 bytes = 128 hex chars
          const IV_LENGTH = 16;    // 16 bytes = 32 hex chars
          const TAG_LENGTH = 16;   // 16 bytes = 32 hex chars
          const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
          const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

          const iv = data.subarray(SALT_LENGTH, TAG_POSITION);
          const tag = data.subarray(TAG_POSITION, ENCRYPTED_POSITION);
          const encrypted = data.subarray(ENCRYPTED_POSITION);

          // Create decipher
          const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
          decipher.setAuthTag(tag);

          // Decrypt the text
          const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
          ]);

          logger.debug('Decrypted message using old format (Salt+IV+AuthTag+Data)');
          return decrypted.toString('utf8');
        } catch (e) {
          logger.error('Old format decryption failed:', e.message);
          return '[Encrypted message - unable to decrypt]';
        }
      }

      // Hex string but too short for either format
      logger.error('Encrypted hex string too short for any known format, length:', encryptedBlob.length);
      return '[Encrypted message - invalid length]';
    }

    // Not an encrypted string, return as plain text
    return encryptedBlob;
  }

  // Handle object format (OLD FORMAT - backward compatibility)
  if (typeof encryptedBlob === 'object') {
    const { iv, authTag, encryptedData } = encryptedBlob;

    // Validate object has required fields
    if (!iv || !authTag || !encryptedData) {
      logger.warn('Invalid encrypted blob structure in decryptMessage');
      return '[Encrypted message - invalid format]';
    }

    try {
      const key = getEncryptionKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));

      // Set the authentication tag
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      logger.debug('Decrypted message using old object format');
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt message (object format):', error.message);
      return '[Encrypted message - decryption failed]';
    }
  }

  // Unknown format
  logger.warn('Unknown encrypted message format:', typeof encryptedBlob);
  return '[Encrypted message - unknown format]';
}

export default {
  encryptObject,
  decryptObject,
  encryptMessage,
  decryptMessage,
  isEncrypted
};
