import crypto from 'crypto';
import Session from '../models/Session.js';
import { getRefreshTokenExpiry } from './tokenUtils.js';

export const SESSION_ROTATION_CONFLICT = 'SESSION_ROTATION_CONFLICT';

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
  const graceExpiry = new Date(now.getTime() + 30 * 60 * 1000);

  const rotatedSession = await sessionModel.findOneAndUpdate(
    {
      sessionId,
      userId,
      isActive: true,
      $or: [
        { refreshTokenHash: providedHash },
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