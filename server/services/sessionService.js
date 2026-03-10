import crypto from 'crypto';
import Session from '../models/Session.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import { cleanupOldSessions, enforceMaxSessions } from '../utils/sessionUtils.js';
import { generateTokenPair, getRefreshTokenExpiry } from '../utils/tokenUtils.js';
import { rotateAuthoritativeSession, PREVIOUS_TOKEN_GRACE_MS } from '../utils/refreshRotation.js';

export const SESSION_SERVICE_STATUS = {
  SUCCESS: 'success',
  INVALID: 'invalid',
  REVOKED: 'revoked',
  NOT_FOUND: 'not_found',
  EXPIRED: 'expired'
};

export const SESSION_REUSE_DETECTED = 'SESSION_REUSE_DETECTED';
export const SESSION_SECURITY_RISK = 'SESSION_SECURITY_RISK';

const SESSION_RISK_THRESHOLD = 60;
const SESSION_RISK_DECAY = 5;

const resolveSessionDevice = ({ device, deviceInfo, browser, os } = {}) => (
  device ||
  deviceInfo ||
  [browser, os].filter((value) => value && !String(value).startsWith('Unknown')).join(' on ') ||
  'Unknown Device'
);

const resolveSessionCountry = ({ country, location } = {}) => (
  country || location?.country || ''
);

const resolveSessionUserAgent = ({ userAgent, browser, os, deviceInfo } = {}) => (
  userAgent || [browser, os, deviceInfo].filter(Boolean).join(' | ') || 'Unknown User Agent'
);

const buildSessionLocation = ({ location, country } = {}) => {
  if (!location && !country) {
    return undefined;
  }

  return {
    ...(location || {}),
    ...(country ? { country } : {})
  };
};

const getSessionDevice = (session) => session?.device || session?.deviceInfo || 'Unknown Device';
const getSessionLastIp = (session) => session?.lastIp || session?.ipAddress || '';
const getSessionLastCountry = (session) => session?.lastCountry || session?.location?.country || '';
const getSessionLastActive = (session) => session?.lastActiveAt || session?.lastActive || session?.createdAt;
const getPreviousTokenGraceUntil = (session) => session?.previousTokenGraceUntil || session?.previousTokenExpiry || null;

const buildSessionSecurityError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const applySessionMetadata = (target, {
  device,
  deviceInfo,
  browser,
  os,
  ipAddress,
  location,
  userAgent,
  country,
  lastActiveAt = new Date()
} = {}) => {
  const normalizedDevice = resolveSessionDevice({ device, deviceInfo, browser, os });
  const normalizedCountry = resolveSessionCountry({ country, location });
  const normalizedLocation = buildSessionLocation({ location, country: normalizedCountry });
  const normalizedUserAgent = resolveSessionUserAgent({
    userAgent,
    browser,
    os,
    deviceInfo: deviceInfo || normalizedDevice
  });

  target.device = normalizedDevice;
  target.deviceInfo = deviceInfo || normalizedDevice;

  if (browser) target.browser = browser;
  if (os) target.os = os;
  if (ipAddress) {
    target.ipAddress = ipAddress;
    target.lastIp = ipAddress;
  }
  if (normalizedUserAgent) {
    target.lastUserAgent = normalizedUserAgent;
  }
  if (normalizedCountry) {
    target.lastCountry = normalizedCountry;
  }
  if (normalizedLocation) {
    target.location = {
      ...(target.location || {}),
      ...normalizedLocation
    };
  }

  target.lastActiveAt = lastActiveAt;
  if (Object.prototype.hasOwnProperty.call(target, 'lastActive')) {
    target.lastActive = lastActiveAt;
  }

  return target;
};

const revokeCachedUserSession = async ({ user, sessionId }) => {
  if (!user || !Array.isArray(user.activeSessions)) {
    return;
  }

  const originalLength = user.activeSessions.length;
  user.activeSessions = user.activeSessions.filter((session) => session.sessionId !== sessionId);

  if (user.activeSessions.length !== originalLength) {
    await user.save();
  }
};

export const calculateSessionRisk = ({ session, ip, userAgent, country }) => {
  if (!session) {
    return 0;
  }

  let riskPoints = 0;
  const lastIp = getSessionLastIp(session);
  const lastUserAgent = session.lastUserAgent || '';
  const lastCountry = getSessionLastCountry(session);

  if (lastIp && ip && lastIp !== ip) {
    riskPoints += 10;
  }

  if (lastUserAgent && userAgent && lastUserAgent !== userAgent) {
    riskPoints += 25;
  }

  if (lastCountry && country && lastCountry !== country) {
    riskPoints += 20;
  }

  if (lastIp && ip && lastIp !== ip && lastCountry && country && lastCountry !== country) {
    riskPoints += 10;
  }

  return riskPoints;
};

export const buildSessionRecord = ({
  sessionId,
  refreshToken,
  device,
  deviceInfo = 'Unknown Device',
  browser = 'Unknown Browser',
  os = 'Unknown OS',
  ipAddress = 'Unknown',
  userAgent,
  country,
  location,
  createdAt = new Date(),
  lastActive = createdAt,
  riskScore = 0,
  isActive = true,
  revokedAt = null
}) => {
  const normalizedDevice = resolveSessionDevice({ device, deviceInfo, browser, os });
  const normalizedCountry = resolveSessionCountry({ country, location });
  const normalizedLocation = buildSessionLocation({ location, country: normalizedCountry });
  const normalizedUserAgent = resolveSessionUserAgent({
    userAgent,
    browser,
    os,
    deviceInfo: normalizedDevice
  });

  return {
    sessionId,
    refreshToken: null,
    refreshTokenHash: Session.hashToken(refreshToken),
    previousRefreshTokenHash: null,
    previousTokenGraceUntil: null,
    previousTokenExpiry: null,
    refreshTokenExpiry: getRefreshTokenExpiry(),
    device: normalizedDevice,
    deviceInfo: normalizedDevice,
    browser,
    os,
    ipAddress,
    lastIp: ipAddress,
    lastUserAgent: normalizedUserAgent,
    lastCountry: normalizedCountry,
    ...(normalizedLocation ? { location: normalizedLocation } : {}),
    riskScore,
    createdAt,
    lastActive,
    isActive,
    revokedAt
  };
};

const buildAuthoritativeSessionPayload = ({ userId, sessionData }) => ({
  userId,
  sessionId: sessionData.sessionId,
  refreshTokenHash: sessionData.refreshTokenHash,
  previousRefreshTokenHash: sessionData.previousRefreshTokenHash || null,
  previousTokenGraceUntil: sessionData.previousTokenGraceUntil || sessionData.previousTokenExpiry || null,
  previousTokenExpiry: sessionData.previousTokenExpiry || sessionData.previousTokenGraceUntil || null,
  refreshTokenExpiry: sessionData.refreshTokenExpiry,
  device: sessionData.device || sessionData.deviceInfo,
  deviceInfo: sessionData.deviceInfo,
  browser: sessionData.browser,
  os: sessionData.os,
  ipAddress: sessionData.ipAddress,
  lastIp: sessionData.lastIp || sessionData.ipAddress,
  lastUserAgent: sessionData.lastUserAgent || '',
  lastCountry: sessionData.lastCountry || sessionData.location?.country || '',
  riskScore: sessionData.riskScore || 0,
  ...(sessionData.location ? { location: sessionData.location } : {}),
  createdAt: sessionData.createdAt,
  lastActiveAt: sessionData.lastActive,
  isActive: sessionData.isActive !== false,
  revokedAt: sessionData.revokedAt || null
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
      const session = await Session.findOneAndUpdate(
        { sessionId: sessionData.sessionId, userId: user._id },
        {
          $set: {
            refreshTokenHash: payload.refreshTokenHash,
            previousRefreshTokenHash: payload.previousRefreshTokenHash,
            previousTokenGraceUntil: payload.previousTokenGraceUntil,
            previousTokenExpiry: payload.previousTokenExpiry,
            refreshTokenExpiry: payload.refreshTokenExpiry,
            device: payload.device,
            deviceInfo: payload.deviceInfo,
            browser: payload.browser,
            os: payload.os,
            ipAddress: payload.ipAddress,
            lastIp: payload.lastIp,
            lastUserAgent: payload.lastUserAgent,
            lastCountry: payload.lastCountry,
            riskScore: payload.riskScore,
            ...(payload.location ? { location: payload.location } : {}),
            lastActiveAt: payload.lastActiveAt,
            isActive: payload.isActive,
            revokedAt: payload.revokedAt
          },
          $setOnInsert: {
            createdAt: payload.createdAt
          }
        },
        { upsert: true, new: true }
      );
      logger.debug(`[Phase 3B-A] Created/updated first-class session ${sessionData.sessionId} for ${logLabel}`);
      return session;
    }

    const session = await Session.create(payload);
    logger.debug(`[Phase 3B-A] Created first-class session ${sessionData.sessionId} for ${logLabel}`);
    return session;
  } catch (sessionError) {
    logger.error('[Phase 3B-A] Failed to persist Session document:', sessionError.message);
    throw sessionError;
  }
};

const createManagedSession = async ({
  user,
  device,
  deviceInfo,
  browser,
  os,
  ipAddress,
  location,
  userAgent,
  country,
  upsert = false,
  logLabel = 'login'
}) => {
  cleanupOldSessions(user);

  const activeSessions = await Session.find({
    userId: user._id,
    isActive: true
  }).select('sessionId device deviceInfo browser os ipAddress lastIp lastUserAgent lastCountry location createdAt lastActiveAt riskScore')
    .sort({ lastActiveAt: -1 })
    .limit(10);

  const normalizedDevice = resolveSessionDevice({ device, deviceInfo, browser, os });
  const normalizedCountry = resolveSessionCountry({ country, location });
  const normalizedUserAgent = resolveSessionUserAgent({
    userAgent,
    browser,
    os,
    deviceInfo: normalizedDevice
  });

  const knownDevices = activeSessions
    .map((activeSession) => getSessionDevice(activeSession))
    .filter(Boolean);

  if (activeSessions.length > 0 && normalizedDevice && !knownDevices.includes(normalizedDevice)) {
    console.warn('[SECURITY]', {
      event: 'new_device_login',
      userId: user._id,
      device: normalizedDevice,
      ip: ipAddress
    });
  }

  const { accessToken, refreshToken, sessionId } = generateTokenPair(user._id);
  const now = new Date();
  const baselineSession = activeSessions[0] || null;
  const sessionData = buildSessionRecord({
    sessionId,
    refreshToken,
    device: normalizedDevice,
    deviceInfo: normalizedDevice,
    browser,
    os,
    ipAddress,
    userAgent: normalizedUserAgent,
    country: normalizedCountry,
    location,
    createdAt: now,
    lastActive: now
  });

  sessionData.riskScore = calculateSessionRisk({
    session: baselineSession,
    ip: ipAddress,
    userAgent: normalizedUserAgent,
    country: normalizedCountry
  });

  if (sessionData.riskScore >= SESSION_RISK_THRESHOLD) {
    sessionData.isActive = false;
    sessionData.revokedAt = now;
    await persistAuthoritativeSession({ user, sessionData, upsert, logLabel });
    console.warn('[SESSION SECURITY]', {
      event: 'risk_threshold_exceeded',
      userId: user._id,
      sessionId
    });
    throw buildSessionSecurityError(SESSION_SECURITY_RISK, 'Session risk threshold exceeded');
  }

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
  device: getSessionDevice(session),
  lastIp: getSessionLastIp(session),
  lastCountry: getSessionLastCountry(session),
  deviceInfo: session.deviceInfo || getSessionDevice(session),
  browser: session.browser || '',
  os: session.os || '',
  ipAddress: session.ipAddress || getSessionLastIp(session),
  location: session.location || (getSessionLastCountry(session) ? { country: getSessionLastCountry(session) } : {}),
  createdAt: session.createdAt,
  lastActive: getSessionLastActive(session),
  lastActiveAt: getSessionLastActive(session),
  isCurrent: session.sessionId === currentSessionId
});

export const listActiveSessionsForUser = async (userIdOrOptions, currentSessionIdArg = null) => {
  const isOptionsObject = typeof userIdOrOptions === 'object' && userIdOrOptions !== null;
  const userId = isOptionsObject ? userIdOrOptions.userId : userIdOrOptions;
  const currentSessionId = isOptionsObject
    ? (userIdOrOptions.currentSessionId || null)
    : currentSessionIdArg;

  const sessions = await Session.find({
    userId,
    isActive: true
  }).select('sessionId device deviceInfo browser os ipAddress lastIp lastCountry location createdAt lastActiveAt')
    .sort({ lastActiveAt: -1 });

  return sessions.map((session) => normalizeSessionForClient(session, currentSessionId));
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
    revokedCount: otherSessions.length,
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
    revokedCount: sessions.length,
    sessionCount: sessions.length,
    revokedSessionIds: sessions.map((session) => session.sessionId)
  };
};

export const touchSessionActivity = async ({
  userId,
  sessionId,
  now = new Date(),
  ipAddress,
  userAgent,
  country
}) => {
  const session = await Session.findOne({
    sessionId,
    userId,
    isActive: true
  });

  if (!session) {
    return null;
  }

  const normalizedCountry = resolveSessionCountry({ country });
  const normalizedUserAgent = resolveSessionUserAgent({ userAgent });
  const riskPoints = calculateSessionRisk({
    session,
    ip: ipAddress,
    userAgent: normalizedUserAgent,
    country: normalizedCountry
  });

  session.riskScore = Number(session.riskScore || 0) + riskPoints;
  session.riskScore = Math.max(0, session.riskScore - SESSION_RISK_DECAY);
  applySessionMetadata(session, {
    ipAddress,
    userAgent: normalizedUserAgent,
    country: normalizedCountry,
    lastActiveAt: now
  });

  if (session.riskScore >= SESSION_RISK_THRESHOLD) {
    session.isActive = false;
    session.revokedAt = now;
    await session.save();
    await User.updateOne(
      { _id: userId },
      { $pull: { activeSessions: { sessionId } } }
    );
    console.warn('[SESSION SECURITY]', {
      event: 'risk_threshold_exceeded',
      userId: session.userId,
      sessionId: session.sessionId
    });
    throw buildSessionSecurityError(SESSION_SECURITY_RISK, 'Session risk threshold exceeded');
  }

  await session.save();

  const activeSessionUpdates = {
    'activeSessions.$.lastActive': now,
    ...(ipAddress ? { 'activeSessions.$.ipAddress': ipAddress } : {}),
    ...(normalizedCountry ? { 'activeSessions.$.location.country': normalizedCountry } : {})
  };

  await User.updateOne(
    { _id: userId, 'activeSessions.sessionId': sessionId },
    { $set: activeSessionUpdates }
  );

  return session;
};

const describeHashPrefix = (hash) => (hash ? `${hash.substring(0, 16)}...` : 'null');

const migrateLegacySession = async ({ user, sessionId, legacySession, refreshToken }) => {
  try {
    const normalizedDevice = resolveSessionDevice({
      deviceInfo: legacySession.deviceInfo,
      browser: legacySession.browser,
      os: legacySession.os
    });
    const normalizedCountry = resolveSessionCountry({ location: legacySession.location });

    const session = await Session.create({
      userId: user._id,
      sessionId,
      refreshTokenHash: legacySession.refreshTokenHash || Session.hashToken(refreshToken),
      previousRefreshTokenHash: legacySession.previousRefreshTokenHash,
      previousTokenGraceUntil: legacySession.previousTokenGraceUntil || legacySession.previousTokenExpiry,
      previousTokenExpiry: legacySession.previousTokenExpiry,
      refreshTokenExpiry: legacySession.refreshTokenExpiry || getRefreshTokenExpiry(),
      device: normalizedDevice,
      deviceInfo: legacySession.deviceInfo || normalizedDevice,
      browser: legacySession.browser || 'Unknown Browser',
      os: legacySession.os || 'Unknown OS',
      ipAddress: legacySession.ipAddress,
      lastIp: legacySession.ipAddress,
      lastUserAgent: resolveSessionUserAgent({
        browser: legacySession.browser,
        os: legacySession.os,
        deviceInfo: legacySession.deviceInfo || normalizedDevice
      }),
      lastCountry: normalizedCountry,
      location: legacySession.location,
      riskScore: legacySession.riskScore || 0,
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

  return {
    status: SESSION_SERVICE_STATUS.SUCCESS,
    session,
    legacySession,
    sessionIndex,
    legacyMigrated: false
  };
};

export const rotateRefreshSession = async ({
  user,
  sessionId,
  refreshToken,
  browser,
  os,
  ipAddress,
  userAgent,
  country
}) => {
  const resolvedState = await resolveRefreshSessionState({ user, sessionId, refreshToken });
  if (resolvedState.status !== SESSION_SERVICE_STATUS.SUCCESS) {
    return resolvedState;
  }

  const { session, legacySession, sessionIndex, legacyMigrated } = resolvedState;
  const tokenExpiry = session?.refreshTokenExpiry || legacySession?.refreshTokenExpiry;
  const now = new Date();

  if (tokenExpiry && new Date() > tokenExpiry) {
    if (session) {
      await Session.updateOne(
        { sessionId, userId: user._id },
        { $set: { isActive: false, revokedAt: now } }
      );
    }

    await revokeCachedUserSession({ user, sessionId });

    return {
      status: SESSION_SERVICE_STATUS.EXPIRED,
      reason: 'token_expired'
    };
  }

  const incomingHash = Session.hashToken(refreshToken);
  const currentHash = session?.refreshTokenHash || null;
  const previousHash = session?.previousRefreshTokenHash || null;
  const previousTokenGraceUntil = getPreviousTokenGraceUntil(session);
  const withinGrace = previousTokenGraceUntil ? now < new Date(previousTokenGraceUntil) : false;
  const matchesCurrent = !!currentHash && incomingHash === currentHash;
  const matchesPrevious = !!previousHash && incomingHash === previousHash && withinGrace;

  if (session && !matchesCurrent && !matchesPrevious) {
    session.isActive = false;
    session.revokedAt = now;
    await session.save();
    await revokeCachedUserSession({ user, sessionId });
    console.warn('[SESSION SECURITY]', {
      event: 'refresh_token_reuse',
      userId: session.userId,
      sessionId: session.sessionId
    });
    throw buildSessionSecurityError(SESSION_REUSE_DETECTED, 'Refresh token reuse detected');
  }

  const normalizedDevice = resolveSessionDevice({
    device: getSessionDevice(session) || getSessionDevice(legacySession),
    deviceInfo: session?.deviceInfo || legacySession?.deviceInfo,
    browser: browser || session?.browser || legacySession?.browser,
    os: os || session?.os || legacySession?.os
  });
  const normalizedCountry = resolveSessionCountry({
    country,
    location: session?.location || legacySession?.location
  });
  const normalizedUserAgent = resolveSessionUserAgent({
    userAgent,
    browser: browser || session?.browser || legacySession?.browser,
    os: os || session?.os || legacySession?.os,
    deviceInfo: normalizedDevice
  });
  const riskPoints = calculateSessionRisk({
    session,
    ip: ipAddress,
    userAgent: normalizedUserAgent,
    country: normalizedCountry
  });
  const nextRiskScore = Number(session?.riskScore || 0) + riskPoints;

  if (session && nextRiskScore >= SESSION_RISK_THRESHOLD) {
    session.riskScore = nextRiskScore;
    applySessionMetadata(session, {
      device: normalizedDevice,
      deviceInfo: normalizedDevice,
      browser,
      os,
      ipAddress,
      location: session.location || legacySession?.location,
      userAgent: normalizedUserAgent,
      country: normalizedCountry,
      lastActiveAt: now
    });
    session.isActive = false;
    session.revokedAt = now;
    await session.save();
    await revokeCachedUserSession({ user, sessionId });
    console.warn('[SESSION SECURITY]', {
      event: 'risk_threshold_exceeded',
      userId: session.userId,
      sessionId: session.sessionId
    });
    throw buildSessionSecurityError(SESSION_SECURITY_RISK, 'Session risk threshold exceeded');
  }

  const tokens = generateTokenPair(user._id, sessionId);
  const nextRefreshHash = Session.hashToken(tokens.refreshToken);
  const previousTokenHash = currentHash || incomingHash;
  const graceUntil = new Date(now.getTime() + PREVIOUS_TOKEN_GRACE_MS);
  let rotatedSession = session;

  if (session) {
    rotatedSession = await rotateAuthoritativeSession({
      sessionId,
      userId: user._id,
      refreshToken,
      newRefreshToken: tokens.refreshToken
    });

    rotatedSession.riskScore = nextRiskScore;
    applySessionMetadata(rotatedSession, {
      device: normalizedDevice,
      deviceInfo: normalizedDevice,
      browser,
      os,
      ipAddress,
      location: rotatedSession.location || session.location || legacySession?.location,
      userAgent: normalizedUserAgent,
      country: normalizedCountry,
      lastActiveAt: now
    });
    await rotatedSession.save();
  }

  if (sessionIndex >= 0) {
    const activeSession = user.activeSessions[sessionIndex];
    activeSession.previousRefreshTokenHash = previousTokenHash;
    activeSession.previousTokenGraceUntil = graceUntil;
    activeSession.previousTokenExpiry = graceUntil;
    activeSession.previousRefreshToken = null;
    activeSession.refreshToken = null;
    activeSession.refreshTokenHash = nextRefreshHash;
    activeSession.refreshTokenExpiry = getRefreshTokenExpiry();
    activeSession.lastTokenRotation = now;
    activeSession.lastActive = now;

    activeSession.deviceInfo = normalizedDevice;
    if (browser) activeSession.browser = browser;
    if (os) activeSession.os = os;
    if (ipAddress) activeSession.ipAddress = ipAddress;
    if (normalizedCountry) {
      activeSession.location = {
        ...(activeSession.location || {}),
        country: normalizedCountry
      };
    }

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