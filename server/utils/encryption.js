import crypto from 'crypto';
import config from '../config/config.js';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Get encryption key from environment variable
 * The key must be 32 bytes (64 hex characters)
 */
function getEncryptionKey() {
  const key = process.env.MESSAGE_ENCRYPTION_KEY;
  
  if (!key) {
    if (config.nodeEnv === 'production') {
      throw new Error('MESSAGE_ENCRYPTION_KEY is required in production!');
    }
    // Development fallback (NOT SECURE - only for local development)
    console.warn('⚠️ WARNING: Using default encryption key. Set MESSAGE_ENCRYPTION_KEY in production!');
    return crypto.createHash('sha256').update('dev-encryption-key-CHANGE-IN-PRODUCTION').digest();
  }
  
  // Convert hex string to buffer
  if (key.length !== 64) {
    throw new Error('MESSAGE_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt text using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text in hex format
 */
export function encryptMessage(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text to encrypt must be a non-empty string');
  }
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the text
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);
    
    // Get authentication tag
    const tag = cipher.getAuthTag();
    
    // Combine salt + iv + tag + encrypted data
    const result = Buffer.concat([salt, iv, tag, encrypted]);
    
    // Return as hex string
    return result.toString('hex');
  } catch (error) {
    console.error('❌ Encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypt text using AES-256-GCM
 * @param {string} encryptedHex - Encrypted text in hex format
 * @returns {string} - Decrypted plain text
 */
export function decryptMessage(encryptedHex) {
  if (!encryptedHex || typeof encryptedHex !== 'string') {
    throw new Error('Encrypted text must be a non-empty string');
  }
  
  try {
    const key = getEncryptionKey();
    const data = Buffer.from(encryptedHex, 'hex');
    
    // Extract components
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = data.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = data.subarray(ENCRYPTED_POSITION);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt the text
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('❌ Decryption error:', error);
    throw new Error('Failed to decrypt message');
  }
}

/**
 * Generate a new encryption key
 * Use this to generate MESSAGE_ENCRYPTION_KEY for .env
 * @returns {string} - 64 character hex string (32 bytes)
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Check if a string is encrypted (basic heuristic)
 * @param {string} text - Text to check
 * @returns {boolean} - True if text appears to be encrypted
 */
export function isEncrypted(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Encrypted messages are hex strings with specific minimum length
  const minLength = (SALT_LENGTH + IV_LENGTH + TAG_LENGTH) * 2; // *2 for hex encoding
  return /^[0-9a-f]+$/i.test(text) && text.length >= minLength;
}

/**
 * Encrypt a string value (alias for encryptMessage)
 * Use for encrypting sensitive data like 2FA secrets
 * @param {string} value - Plain text to encrypt
 * @returns {string} - Encrypted text in hex format
 */
export function encryptString(value) {
  return encryptMessage(value);
}

/**
 * Decrypt a string value (alias for decryptMessage)
 * Use for decrypting sensitive data like 2FA secrets
 * @param {string} encryptedValue - Encrypted text in hex format
 * @returns {string} - Decrypted plain text
 */
export function decryptString(encryptedValue) {
  return decryptMessage(encryptedValue);
}

// Export for testing
export const _test = {
  ALGORITHM,
  IV_LENGTH,
  SALT_LENGTH,
  TAG_LENGTH
};

