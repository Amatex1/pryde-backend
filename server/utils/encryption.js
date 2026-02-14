import crypto from 'crypto';

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
  // Handle string format (raw encrypted data without metadata)
  if (typeof encryptedBlob === 'string') {
    // If it looks like a hex string, try to decrypt it as raw encrypted data
    if (encryptedBlob.length > 64 && /^[a-f0-9]+$/i.test(encryptedBlob)) {
      try {
        const key = getEncryptionKey();
        // For raw encrypted strings, we need to extract IV and authTag from the beginning
        // Standard GCM format: IV (32 hex chars = 16 bytes) + AuthTag (32 hex chars = 16 bytes) + Ciphertext
        const ivHex = encryptedBlob.substring(0, 32);
        const authTagHex = encryptedBlob.substring(32, 64);
        const encryptedData = encryptedBlob.substring(64);
        
        if (ivHex.length === 32 && authTagHex.length === 32 && encryptedData.length > 0) {
          const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
          decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
          
          let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          
          return decrypted;
        }
      } catch (e) {
        // If raw decryption fails, return as-is
        console.log('⚠️ Raw string decryption failed, returning as plain text:', e.message);
        return encryptedBlob;
      }
    }
    // Not an encrypted string, return as plain text
    return encryptedBlob;
  }

  if (!encryptedBlob || typeof encryptedBlob !== 'object') {
    throw new Error('decryptMessage requires a valid encrypted blob');
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

    return decrypted;
  } catch (error) {
    // Handle backward compatibility: if decryption fails, assume it's plain text
    // This allows migration from unencrypted to encrypted data
    if (typeof encryptedBlob === 'string') {
      return encryptedBlob;
    }
    throw new Error('Failed to decrypt message: ' + error.message);
  }
}




export default {
  encryptObject,
  decryptObject,
  encryptMessage,
  decryptMessage,
  isEncrypted
};
