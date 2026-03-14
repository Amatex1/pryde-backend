import crypto from 'crypto';
import Session from '../models/Session.js';
import { getRefreshTokenExpiry } from './tokenUtils.js';

export const SESSION_ROTATION_CONFLICT = 'SESSION_ROTATION_CONFLICT';
// TASK #2: Reduced from 30min → 5min (300s)
export const PREVIOUS_TOKEN_GRACE_MS = 5 * 60 * 1000; // 5 minutes

export const hashRefreshToken = (token) => (
  crypto.createHash('sha256').update(token).digest('hex')
);

export const rotateAuthoritativeSession = async ({
  sessionId,
  userId,
  refreshToken,
  newRefreshToken,
  sessionModel = Session,
  now = new Date(),
  refreshTokenExpiry = getRefreshTokenExpiry()
}) => {
  const providedHash = hashRefreshToken(refreshToken);
  const newHash = hashRefreshToken(newRefreshToken);
  const graceExpiry = new Date(now.getTime() + PREVIOUS_TOKEN_GRACE_MS);

  const rotatedSession = await sessionModel.findOneAndUpdate(
    {
      sessionId,
      userId,
      isActive: true,
      $or: [
        { refreshTokenHash: providedHash },
        {
          previousRefreshTokenHash: providedHash,
          previousTokenGraceUntil: { $gt: now }
        },
        {
          previousRefreshTokenHash: providedHash,
          previousTokenExpiry: { $gt: now }
        }
      ]
    },
    [
      {
        $set: {
          previousRefreshTokenHash: '$refreshTokenHash',
          previousTokenGraceUntil: graceExpiry,
          previousTokenExpiry: graceExpiry,
          refreshTokenHash: newHash,
          refreshTokenExpiry,
          lastActiveAt: now,
          lastTokenRotation: now
        }
      }
    ],
    { new: true }
  );

  if (!rotatedSession) {
    const error = new Error('Refresh token rotation conflict');
    error.code = SESSION_ROTATION_CONFLICT;
    throw error;
  }

  return rotatedSession;
};