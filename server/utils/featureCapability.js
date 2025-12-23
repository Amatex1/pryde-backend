/**
 * Feature Capability Checker
 * Determines what features a user can access based on account state
 */

/**
 * Check if user can create posts
 * @param {Object} user - User document
 * @returns {Object} { allowed: boolean, reasons: string[] }
 */
export const canPost = (user) => {
  const reasons = [];

  // Critical blockers
  if (!user) {
    return { allowed: false, reasons: ['User not found'] };
  }

  if (user.isDeleted) {
    reasons.push('Account is deleted');
  }

  if (!user.isActive) {
    reasons.push('Account is deactivated');
  }

  if (user.isBanned) {
    reasons.push('Account is banned');
  }

  if (user.isSuspended && user.suspendedUntil > new Date()) {
    reasons.push(`Account is suspended until ${user.suspendedUntil.toISOString()}`);
  }

  // Moderation blockers
  if (user.moderation?.isMuted && user.moderation?.muteExpires > new Date()) {
    reasons.push(`User is muted until ${user.moderation.muteExpires.toISOString()}`);
  }

  // Soft blockers (warnings, not hard blocks)
  const warnings = [];
  if (!user.emailVerified) {
    warnings.push('Email not verified');
  }

  if (!user.onboardingCompleted) {
    warnings.push('Onboarding not completed');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    warnings
  };
};

/**
 * Check if user can send messages
 * @param {Object} user - User document
 * @returns {Object} { allowed: boolean, reasons: string[] }
 */
export const canMessage = (user) => {
  const reasons = [];

  if (!user) {
    return { allowed: false, reasons: ['User not found'] };
  }

  if (user.isDeleted) {
    reasons.push('Account is deleted');
  }

  if (!user.isActive) {
    reasons.push('Account is deactivated');
  }

  if (user.isBanned) {
    reasons.push('Account is banned');
  }

  if (user.isSuspended && user.suspendedUntil > new Date()) {
    reasons.push(`Account is suspended until ${user.suspendedUntil.toISOString()}`);
  }

  if (user.moderation?.isMuted && user.moderation?.muteExpires > new Date()) {
    reasons.push(`User is muted until ${user.moderation.muteExpires.toISOString()}`);
  }

  const warnings = [];
  if (!user.emailVerified) {
    warnings.push('Email not verified');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    warnings
  };
};

/**
 * Check if user can upload media
 * @param {Object} user - User document
 * @returns {Object} { allowed: boolean, reasons: string[] }
 */
export const canUploadMedia = (user) => {
  const reasons = [];

  if (!user) {
    return { allowed: false, reasons: ['User not found'] };
  }

  if (user.isDeleted) {
    reasons.push('Account is deleted');
  }

  if (!user.isActive) {
    reasons.push('Account is deactivated');
  }

  if (user.isBanned) {
    reasons.push('Account is banned');
  }

  if (user.isSuspended && user.suspendedUntil > new Date()) {
    reasons.push(`Account is suspended until ${user.suspendedUntil.toISOString()}`);
  }

  const warnings = [];
  if (!user.emailVerified) {
    warnings.push('Email not verified');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    warnings
  };
};

/**
 * Check if user can reply to posts/comments
 * @param {Object} user - User document
 * @returns {Object} { allowed: boolean, reasons: string[] }
 */
export const canReply = (user) => {
  const reasons = [];

  if (!user) {
    return { allowed: false, reasons: ['User not found'] };
  }

  if (user.isDeleted) {
    reasons.push('Account is deleted');
  }

  if (!user.isActive) {
    reasons.push('Account is deactivated');
  }

  if (user.isBanned) {
    reasons.push('Account is banned');
  }

  if (user.isSuspended && user.suspendedUntil > new Date()) {
    reasons.push(`Account is suspended until ${user.suspendedUntil.toISOString()}`);
  }

  if (user.moderation?.isMuted && user.moderation?.muteExpires > new Date()) {
    reasons.push(`User is muted until ${user.moderation.muteExpires.toISOString()}`);
  }

  const warnings = [];
  if (!user.emailVerified) {
    warnings.push('Email not verified');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    warnings
  };
};

/**
 * Check if user can participate in group chats
 * @param {Object} user - User document
 * @returns {Object} { allowed: boolean, reasons: string[] }
 */
export const canChat = (user) => {
  const reasons = [];

  if (!user) {
    return { allowed: false, reasons: ['User not found'] };
  }

  if (user.isDeleted) {
    reasons.push('Account is deleted');
  }

  if (!user.isActive) {
    reasons.push('Account is deactivated');
  }

  if (user.isBanned) {
    reasons.push('Account is banned');
  }

  if (user.isSuspended && user.suspendedUntil > new Date()) {
    reasons.push(`Account is suspended until ${user.suspendedUntil.toISOString()}`);
  }

  if (user.moderation?.isMuted && user.moderation?.muteExpires > new Date()) {
    reasons.push(`User is muted until ${user.moderation.muteExpires.toISOString()}`);
  }

  const warnings = [];
  if (!user.emailVerified) {
    warnings.push('Email not verified');
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    warnings
  };
};

/**
 * Get comprehensive capability report for a user
 * @param {Object} user - User document
 * @returns {Object} Complete capability report
 */
export const getUserCapabilities = (user) => {
  if (!user) {
    return {
      userId: null,
      username: null,
      error: 'User not found',
      capabilities: {}
    };
  }

  return {
    userId: user._id,
    username: user.username,
    role: user.role,
    accountState: {
      isActive: user.isActive,
      isDeleted: user.isDeleted,
      isBanned: user.isBanned,
      isSuspended: user.isSuspended,
      suspendedUntil: user.suspendedUntil,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
      isMuted: user.moderation?.isMuted,
      muteExpires: user.moderation?.muteExpires
    },
    capabilities: {
      canPost: canPost(user),
      canMessage: canMessage(user),
      canUploadMedia: canUploadMedia(user),
      canReply: canReply(user),
      canChat: canChat(user)
    }
  };
};
