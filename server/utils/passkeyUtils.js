import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import config from '../config/config.js';

/**
 * WebAuthn/Passkey Configuration
 *
 * CRITICAL: RP ID and Origin must match EXACTLY for WebAuthn to work
 * - RP ID: The domain (without protocol or port)
 * - Origin: The full URL (with protocol, without trailing slash)
 *
 * Production: prydeapp.com (behind Cloudflare)
 * Development: localhost
 */

// Relying Party (RP) Information
const rpName = 'Pryde Social';

// FORCE CORRECT RP ID & ORIGIN FOR PRODUCTION
// RP ID must be the domain only (no protocol, no port, no path)
const RP_ID = 'prydeapp.com';
const ORIGIN = 'https://prydeapp.com';

// Use environment variables ONLY in development
const rpID = process.env.NODE_ENV === 'production'
  ? RP_ID
  : (process.env.RP_ID || 'localhost');

const origin = process.env.NODE_ENV === 'production'
  ? ORIGIN
  : (process.env.ORIGIN || 'http://localhost:3000');

// Log configuration on startup
console.log('🔐 Passkey Configuration:');
console.log('   Environment:', process.env.NODE_ENV || 'development');
console.log('   RP Name:', rpName);
console.log('   RP ID:', rpID);
console.log('   Origin:', origin);
console.log('   RP ID Source:', process.env.NODE_ENV === 'production' ? 'FORCED (production)' : 'ENV/DEFAULT');

/**
 * Generate registration options for creating a new passkey
 * @param {Object} user - User object from database
 * @returns {Object} Registration options for WebAuthn
 */
export const generatePasskeyRegistrationOptions = async (user) => {
  // Get existing passkeys to exclude them from registration
  const excludeCredentials = user.passkeys?.map(passkey => ({
    id: Buffer.from(passkey.credentialId, 'base64'),
    type: 'public-key',
    transports: passkey.transports || []
  })) || [];

  // Convert user ID to Uint8Array (required by @simplewebauthn v13+)
  const userIdString = user._id.toString();
  const userIdBuffer = Buffer.from(userIdString);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: userIdBuffer, // Must be Uint8Array, not string
    userName: user.email,
    userDisplayName: user.displayName || user.username,
    // Don't prompt users for additional information about the authenticator
    attestationType: 'none',
    // Prevent users from re-registering existing authenticators
    excludeCredentials,
    // Authenticator selection criteria
    authenticatorSelection: {
      // Prefer platform authenticators (Face ID, Touch ID, Windows Hello)
      authenticatorAttachment: 'platform',
      // Require user verification (biometric or PIN)
      userVerification: 'required',
      // Require resident key (passkey stored on device)
      residentKey: 'required',
      requireResidentKey: true
    }
  });

  return options;
};

/**
 * Verify passkey registration response
 * @param {Object} response - Registration response from client
 * @param {String} expectedChallenge - Expected challenge from registration options
 * @returns {Object} Verification result
 */
export const verifyPasskeyRegistration = async (response, expectedChallenge) => {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true
  });

  return verification;
};

/**
 * Generate authentication options for logging in with passkey
 * @param {Array} passkeys - User's existing passkeys (optional)
 * @returns {Object} Authentication options for WebAuthn
 */
export const generatePasskeyAuthenticationOptions = async (passkeys = []) => {
  // If user has passkeys, only allow those
  const allowCredentials = passkeys.length > 0 ? passkeys
    .filter(passkey => {
      // Skip passkeys with invalid credentialId
      if (!passkey.credentialId || typeof passkey.credentialId !== 'string') {
        console.warn('⚠️ Skipping passkey with invalid credentialId:', passkey._id);
        return false;
      }
      return true;
    })
    .map(passkey => ({
      id: passkey.credentialId, // Already a base64url string from @simplewebauthn v13+
      type: 'public-key',
      transports: passkey.transports || []
    })) : [];

  const options = await generateAuthenticationOptions({
    rpID,
    // If no passkeys provided, allow any passkey (for discoverable credentials)
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    userVerification: 'required'
  });

  return options;
};

/**
 * Verify passkey authentication response
 * @param {Object} response - Authentication response from client
 * @param {String} expectedChallenge - Expected challenge from authentication options
 * @param {Object} passkey - Passkey object from database
 * @returns {Object} Verification result
 */
export const verifyPasskeyAuthentication = async (response, expectedChallenge, passkey) => {
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    // @simplewebauthn v13+ uses 'credential' instead of 'authenticator'
    credential: {
      id: passkey.credentialId, // Already a base64url string
      publicKey: Buffer.from(passkey.publicKey, 'base64'),
      counter: passkey.counter,
      transports: passkey.transports || []
    },
    requireUserVerification: true
  });

  return verification;
};

/**
 * Get device name from user agent
 * @param {String} userAgent - User agent string
 * @returns {String} Device name
 */
export const getDeviceName = (userAgent) => {
  if (!userAgent) return 'Unknown Device';

  // Detect device type
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/Macintosh/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'Windows PC';
  if (/Android/.test(userAgent)) return 'Android Device';
  if (/Linux/.test(userAgent)) return 'Linux Device';

  return 'Unknown Device';
};

export default {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  getDeviceName,
  rpName,
  rpID,
  origin
};

