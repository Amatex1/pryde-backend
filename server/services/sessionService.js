import crypto from 'crypto';
import Session from '../models/Session.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { cleanupOldSessions, enforceMaxSessions } from '../utils/sessionUtils.js';
import { generateTokenPair, getRefreshTokenExpiry } from '../utils/tokenUtils.js';
import { rotateAuthoritativeSession } from '../utils/refreshRotation.js';

export const SESSION_SERVICE_STATUS = {
  SUCCESS: 'success',
  INVALID: 'invalid',
  REVOKED: 'revoked',
  NOT_FOUND: 'not_found',
  EXPIRED: 'expired'
};

export const buildSessionRecord = ({
  sessionId,
  refreshToken,
  deviceInfo = 'Unknown Device',
  browser = 'Unknown Browser',
  os = 'Unknown OS',
  ipAddress = 'Unknown',
  location,
  createdAt = new Date(),
  lastActive = createdAt
}) => ({
  sessionId,
  refreshToken: null,
  refreshTokenHash: Session.hashToken(refreshToken),
  refreshTokenExpiry: getRefreshTokenExpiry(),
  deviceInfo,
  browser,
  os,
  ipAddress,
  ...(location ? { location } : {}),
  createdAt,
  lastActive
});

const buildAuthoritativeSessionPayload = ({ userId, sessionData }) => ({
  userId,
  sessionId: sessionData.sessionId,
  refreshTokenHash: sessionData.refreshTokenHash,
  refreshTokenExpiry: sessionData.refreshTokenExpiry,
  deviceInfo: sessionData.deviceInfo,
  browser: sessionData.browser,
  os: sessionData.os,
  ipAddress: sessionData.ipAddress,
  ...(sessionData.location ? { location: sessionData.location } : {}),
  createdAt: sessionData.createdAt,
  lastActiveAt: sessionData.lastActive,
  isActive: true
});

export const syncCachedUserSession = ({ user, sessionData }) => {
  if (!Array.isArray(user.activeSessions)) {
    user.activeSessions = [];
  }

  const sessionIndex = user.activeSessions.findIndex(
    (activeSession) => activeSession.sessionId === sessionData.sessionId
  );

  if (sessionIndex >= 0) {
    user.activeSessions[sessionIndex] = sessionData;
  } else {
    user.activeSessions.push(sessionData);
  }

  return sessionIndex;
};

const persistAuthoritativeSession = async ({ user, sessionData, upsert = false, logLabel = 'login' }) => {
  try {
    const payload = buildAuthoritativeSessionPayload({ userId: user._id, sessionData });

    if (upsert) {
      await Session.findOneAndUpdate(
        { sessionId: sessionData.sessionId, userId: user._id },
        {
          $set: {
            refreshTokenHash: payload.refreshTokenHash,
            refreshTokenExpiry: payload.refreshTokenExpiry,
            deviceInfo: payload.deviceInfo,
            browser: payload.browser,
            os: payload.os,
            ipAddress: payload.ipAddress,
            ...(payload.location ? { location: payload.location } : {}),
            lastActiveAt: payload.lastActiveAt,
            isActive: true
          },
          $setOnInsert: {
            createdAt: payload.createdAt
          }
        },
        { upsert: true, new: true }
      );
      logger.debug(`[Phase 3B-A] Created/updated first-class session ${sessionData.sessionId} for ${logLabel}`);
      return;
    }

    await Session.create(payload);
    logger.debug(`[Phase 3B-A] Created first-class session ${sessionData.sessionId} for ${logLabel}`);
  } catch (sessionError) {
    logger.error('[Phase 3B-A] Failed to persist Session document:', sessionError.message);
  }
};

const createManagedSession = async ({
  user,
  deviceInfo,
  browser,
  os,
  ipAddress,
  location,
  upsert = false,
  logLabel = 'login'
}) => {
  cleanupOldSessions(user);

  const { accessToken, refreshToken, sessionId } = generateTokenPair(user._id);
  const now = new Date();
  const sessionData = buildSessionRecord({
    sessionId,
    refreshToken,
    deviceInfo,
    browser,
    os,
    ipAddress,
    location,
    createdAt: now,
    lastActive: now
  });

  await persistAuthoritativeSession({ user, sessionData, upsert, logLabel });
  syncCachedUserSession({ user, sessionData });
  enforceMaxSessions(user);
  await user.save();

  return {
    accessToken,
    refreshToken,
    sessionId,
    sessionData
  };
};

export const createLoginSession = async (options) => createManagedSession(options);

export const createPasskeySession = async (options) => createManagedSession({
  ...options,
  logLabel: options.logLabel || 'passkey login'
});

export const normalizeSessionForClient = (session, currentSessionId = null) => ({
  sessionId: session.sessionId,
  deviceInfo: session.deviceInfo || '',
  browser: session.browser || '',
  os: session.os || '',
  ipAddress: session.ipAddress || '',
  location: session.location || {},
  createdAt: session.createdAt,
  lastActive: session.lastActiveAt,
  lastActiveAt: session.lastActiveAt,
  isCurrent: session.sessionId === currentSessionId
});

export const listActiveSessionsForUser = async ({ userId, currentSessionId = null }) => {
  const sessions = await Session.find({
    userId,
    isActive: true
  }).select('sessionId deviceInfo browser os ipAddress location createdAt lastActiveAt')
    .sort({ lastActiveAt: -1 });

  return {
    sessions: sessions.map((session) => normalizeSessionForClient(session, currentSessionId)),
    total: sessions.length
  };
};

export const revokeSession = async ({ userId, sessionId, requireActive = true }) => {
  const revokedAt = new Date();
  let session = null;

  if (requireActive) {
    session = await Session.findOneAndUpdate(
      { sessionId, userId, isActive: true },
      { $set: { isActive: false, revokedAt } },
      { new: true }
    );

    if (!session) {
      return null;
    }
  } else {
    await Session.updateOne(
      { sessionId, userId },
      { $set: { isActive: false, revokedAt } }
    );
  }

  await User.updateOne(
    { _id: userId },
    { $pull: { activeSessions: { sessionId } } }
  );

  return session || { sessionId, revokedAt };
};

export const revokeOtherSessions = async ({ userId, currentSessionId }) => {
  const revokedAt = new Date();
  const otherSessions = await Session.find({
    userId,
    isActive: true,
    sessionId: { $ne: currentSessionId }
  }).select('sessionId');

  await Session.updateMany(
    { userId, isActive: true, sessionId: { $ne: currentSessionId } },
    { $set: { isActive: false, revokedAt } }
  );

  await User.updateOne(
    { _id: userId },
    { $pull: { activeSessions: { sessionId: { $ne: currentSessionId } } } }
  );

  const remainingSessions = await Session.countDocuments({ userId, isActive: true });

  return {
    otherSessionsCount: otherSessions.length,
    remainingSessions,
    revokedSessionIds: otherSessions.map((session) => session.sessionId)
  };
};

export const revokeAllSessions = async ({ userId }) => {
  const revokedAt = new Date();
  const sessions = await Session.find({ userId, isActive: true }).select('sessionId');

  await Session.updateMany(
    { userId, isActive: true },
    { $set: { isActive: false, revokedAt } }
  );

  await User.updateOne(
    { _id: userId },
    { $set: { activeSessions: [] } }
  );

  return {
    sessionCount: sessions.length,
    revokedSessionIds: sessions.map((session) => session.sessionId)
  };
};

export const touchSessionActivity = async ({ userId, sessionId, now = new Date() }) => {
  await Session.updateOne(
    { sessionId, userId, isActive: true },
    { $set: { lastActiveAt: now } }
  );

  await User.updateOne(
    { _id: userId, 'activeSessions.sessionId': sessionId },
    { $set: { 'activeSessions.$.lastActive': now } }
  );
};

const describeHashPrefix = (hash) => (hash ? `${hash.substring(0, 16)}...` : 'null');

const migrateLegacySession = async ({ user, sessionId, legacySession, refreshToken }) => {
  try {
    const session = await Session.create({
      userId: user._id,
      sessionId,
      refreshTokenHash: legacySession.refreshTokenHash || Session.hashToken(refreshToken),
      previousRefreshTokenHash: legacySession.previousRefreshTokenHash,
      previousTokenExpiry: legacySession.previousTokenExpiry,
      refreshTokenExpiry: legacySession.refreshTokenExpiry || getRefreshTokenExpiry(),
      deviceInfo: legacySession.deviceInfo || 'Unknown Device',
      browser: legacySession.browser || 'Unknown Browser',
      os: legacySession.os || 'Unknown OS',
      ipAddress: legacySession.ipAddress,
      location: legacySession.location,
      createdAt: legacySession.createdAt || new Date(),
      lastActiveAt: legacySession.lastActive || new Date(),
      isActive: true
    });

    logger.info(`[LegacyMigration] Created Session document for ${sessionId}`);
    return session;
  } catch (migrationError) {
    if (migrationError.code === 11000) {
      return Session.findOne({
        sessionId,
        userId: user._id,
        isActive: true
      }).select('+refreshTokenHash +previousRefreshTokenHash');
    }

    logger.warn('[LegacyMigration] Could not create Session document:', migrationError.message);
    return null;
  }
};

const resolveRefreshSessionState = async ({ user, sessionId, refreshToken }) => {
  let session = await Session.findOne({
    sessionId,
    userId: user._id,
    isActive: true
  }).select('+refreshTokenHash +previousRefreshTokenHash');

  const sessionIndex = user.activeSessions.findIndex(
    (activeSession) => activeSession.sessionId === sessionId
  );
  const legacySession = sessionIndex >= 0 ? user.activeSessions[sessionIndex] : null;

  if (!session) {
    const revokedSession = await Session.findOne({
      sessionId,
      userId: user._id,
      isActive: false
    });

    if (revokedSession) {
      return { status: SESSION_SERVICE_STATUS.REVOKED };
    }

    if (!legacySession) {
      return {
        status: SESSION_SERVICE_STATUS.NOT_FOUND,
        reason: 'session_not_found'
      };
    }

    logger.info(`[LegacyFallback] Using User.activeSessions for session ${sessionId}`);
    const legacyTokenValid = user.verifyRefreshToken(legacySession, refreshToken);

    if (!legacyTokenValid) {
      const providedHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      logger.warn(`🔴 Legacy token mismatch for session ${sessionId}:`, {
        providedHashPrefix: describeHashPrefix(providedHash),
        currentHashPrefix: describeHashPrefix(legacySession.refreshTokenHash),
        previousHashPrefix: describeHashPrefix(legacySession.previousRefreshTokenHash),
        hasPlaintextToken: !!legacySession.refreshToken,
        previousTokenExpiry: legacySession.previousTokenExpiry,
        graceStillValid: legacySession.previousTokenExpiry ? new Date() < legacySession.previousTokenExpiry : 'no expiry'
      });

      return {
        status: SESSION_SERVICE_STATUS.INVALID,
        reason: 'legacy_token_mismatch'
      };
    }

    session = await migrateLegacySession({ user, sessionId, legacySession, refreshToken });
    return {
      status: SESSION_SERVICE_STATUS.SUCCESS,
      session,
      legacySession,
      sessionIndex,
      legacyMigrated: !!session
    };
  }

  const tokenValid = session.verifyRefreshToken(refreshToken);
  if (!tokenValid) {
    const providedHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    logger.warn(`🔴 Token mismatch for session ${sessionId}:`, {
      providedHashPrefix: describeHashPrefix(providedHash),
      currentHashPrefix: describeHashPrefix(session.refreshTokenHash),
      previousHashPrefix: describeHashPrefix(session.previousRefreshTokenHash),
      previousTokenExpiry: session.previousTokenExpiry,
      graceStillValid: session.previousTokenExpiry ? new Date() < session.previousTokenExpiry : 'no expiry',
      lastRotation: session.lastTokenRotation
    });

    return {
      status: SESSION_SERVICE_STATUS.INVALID,
      reason: 'token_mismatch'
    };
  }

  return {
    status: SESSION_SERVICE_STATUS.SUCCESS,
    session,
    legacySession,
    sessionIndex,
    legacyMigrated: false
  };
};

export const rotateRefreshSession = async ({ user, sessionId, refreshToken, browser, os, ipAddress }) => {
  const resolvedState = await resolveRefreshSessionState({ user, sessionId, refreshToken });
  if (resolvedState.status !== SESSION_SERVICE_STATUS.SUCCESS) {
    return resolvedState;
  }

  const { session, legacySession, sessionIndex, legacyMigrated } = resolvedState;
  const tokenExpiry = session?.refreshTokenExpiry || legacySession?.refreshTokenExpiry;

  if (tokenExpiry && new Date() > tokenExpiry) {
    if (session) {
      await Session.updateOne(
        { sessionId, userId: user._id },
        { $set: { isActive: false, revokedAt: new Date() } }
      );
    }

    if (sessionIndex >= 0) {
      user.activeSessions.splice(sessionIndex, 1);
      await user.save();
    }

    return {
      status: SESSION_SERVICE_STATUS.EXPIRED,
      reason: 'token_expired'
    };
  }

  const tokens = generateTokenPair(user._id, sessionId);

  if (session) {
    await rotateAuthoritativeSession({
      sessionId,
      userId: user._id,
      refreshToken,
      newRefreshToken: tokens.refreshToken
    });
  }

  if (sessionIndex >= 0) {
    const activeSession = user.activeSessions[sessionIndex];
    const currentHash = activeSession.refreshTokenHash || Session.hashToken(refreshToken);

    activeSession.previousRefreshTokenHash = currentHash;
    activeSession.previousTokenExpiry = new Date(Date.now() + 30 * 60 * 1000);
    activeSession.previousRefreshToken = null;
    activeSession.refreshToken = null;
    activeSession.refreshTokenHash = Session.hashToken(tokens.refreshToken);
    activeSession.refreshTokenExpiry = getRefreshTokenExpiry();
    activeSession.lastTokenRotation = new Date();
    activeSession.lastActive = new Date();

    if (browser) activeSession.browser = browser;
    if (os) activeSession.os = os;
    if (ipAddress) activeSession.ipAddress = ipAddress;

    await user.save();
  }

  return {
    status: SESSION_SERVICE_STATUS.SUCCESS,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    sessionId: tokens.sessionId,
    legacyMigrated
  };
};

export const sessionService = {
  buildSessionRecord,
  syncCachedUserSession,
  normalizeSessionForClient,
  createLoginSession,
  createPasskeySession,
  rotateRefreshSession,
  revokeSession,
  revokeOtherSessions,
  revokeAllSessions,
  listActiveSessionsForUser,
  touchSessionActivity
};

export default sessionService;