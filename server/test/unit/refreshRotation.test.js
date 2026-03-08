import { expect } from 'chai';
import {
  hashRefreshToken,
  rotateAuthoritativeSession,
  SESSION_ROTATION_CONFLICT
} from '../../utils/refreshRotation.js';

describe('refreshRotation utility', () => {
  it('builds the atomic rotation query from the provided token hashes', async () => {
    let capturedArgs = null;
    const now = new Date('2026-03-08T09:30:00.000Z');
    const refreshTokenExpiry = new Date('2026-04-07T09:30:00.000Z');
    const fakeSession = { _id: 'session-1' };
    const sessionModel = {
      findOneAndUpdate: async (...args) => {
        capturedArgs = args;
        return fakeSession;
      }
    };

    const result = await rotateAuthoritativeSession({
      sessionId: 'session-123',
      userId: 'user-123',
      refreshToken: 'old-token',
      newRefreshToken: 'new-token',
      sessionModel,
      now,
      refreshTokenExpiry
    });

    expect(result).to.equal(fakeSession);
    expect(capturedArgs).to.have.length(3);

    const [query, pipeline, options] = capturedArgs;
    expect(query).to.deep.equal({
      sessionId: 'session-123',
      userId: 'user-123',
      isActive: true,
      $or: [
        { refreshTokenHash: hashRefreshToken('old-token') },
        {
          previousRefreshTokenHash: hashRefreshToken('old-token'),
          previousTokenExpiry: { $gt: now }
        }
      ]
    });
    expect(pipeline).to.deep.equal([
      {
        $set: {
          previousRefreshTokenHash: '$refreshTokenHash',
          previousTokenExpiry: new Date(now.getTime() + 30 * 60 * 1000),
          refreshTokenHash: hashRefreshToken('new-token'),
          refreshTokenExpiry,
          lastActiveAt: now,
          lastTokenRotation: now
        }
      }
    ]);
    expect(options).to.deep.equal({ new: true });
  });

  it('throws a rotation conflict when the atomic update no longer matches', async () => {
    const sessionModel = {
      findOneAndUpdate: async () => null
    };

    try {
      await rotateAuthoritativeSession({
        sessionId: 'session-123',
        userId: 'user-123',
        refreshToken: 'old-token',
        newRefreshToken: 'new-token',
        sessionModel,
        now: new Date('2026-03-08T09:30:00.000Z'),
        refreshTokenExpiry: new Date('2026-04-07T09:30:00.000Z')
      });
      throw new Error('Expected rotation conflict');
    } catch (error) {
      expect(error.code).to.equal(SESSION_ROTATION_CONFLICT);
    }
  });
});