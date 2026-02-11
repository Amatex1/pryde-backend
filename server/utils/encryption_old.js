import crypto from 'crypto';

/**
 * Recovery Data Encryption Utility
 *
 * Uses AES-256-GCM for authenticated encryption of sensitive recovery data.
 * This ensures that even if the database is compromised, original user data
 * cannot be recovered without the encryption key.
 */

// Get encryption key from environment (32 bytes base64 encoded)
const getEncryptionKey = () => {
  const key = process.env.RECOVERY_ENCRYPTION_KEY;
  if (!key) {
    // Development fallback - NOT for production
    if (process.env.NODE_ENV === 'development') {
      return Buffer.from('dev-key-32-bytes-for-testing-only!', 'utf8');
    }
    throw new Error('RECOVERY_ENCRYPTION_KEY environment variable is required');
  }

  // Decode base64 key
  const decoded = Buffer.from(key, 'base64');
  if (decoded.length !== 32) {
    throw new Error('RECOVERY_ENCRYPTION_KEY must be 32 bytes when base64 decoded');
  }

  return decoded;
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
  return data &&
         typeof data === 'object' &&
         data.iv &&
         data.authTag &&
         data.encryptedData;
}

export default {
  encryptObject,
  decryptObject,
  isEncrypted
};
