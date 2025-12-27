/**
 * Phase 4A: Group Ownership & Moderation
 * 
 * Permission helpers for group-scoped moderation.
 * Groups moderate themselves - platform admins do NOT interfere unless reported.
 * 
 * ROLES:
 * - owner: Immutable, cannot be removed. Has all moderator privileges.
 * - moderator: Can remove members, delete posts. Subset of members.
 * - member: Can view and post. No moderation privileges.
 * 
 * RULES:
 * - Owner ⊃ Moderator (owner implicitly has all moderator privileges)
 * - Moderator ⊂ Member (moderators are always members)
 * - Permissions are scoped to the group only
 */

/**
 * Check if a user is the owner of a group
 * @param {string|ObjectId} userId - User ID to check
 * @param {Object} group - Group document (must have owner field)
 * @returns {boolean}
 */
export function isGroupOwner(userId, group) {
  if (!userId || !group || !group.owner) return false;
  const userIdStr = userId.toString();
  const ownerId = group.owner._id?.toString() || group.owner.toString();
  return ownerId === userIdStr;
}

/**
 * Check if a user is a moderator of a group (NOT including owner)
 * @param {string|ObjectId} userId - User ID to check
 * @param {Object} group - Group document (must have moderators array)
 * @returns {boolean}
 */
export function isGroupModerator(userId, group) {
  if (!userId || !group || !Array.isArray(group.moderators)) return false;
  const userIdStr = userId.toString();
  return group.moderators.some(m => 
    (m._id?.toString() || m.toString()) === userIdStr
  );
}

/**
 * Check if a user is a member of a group (includes owner and moderators)
 * @param {string|ObjectId} userId - User ID to check
 * @param {Object} group - Group document
 * @returns {boolean}
 */
export function isGroupMember(userId, group) {
  if (!userId || !group) return false;
  
  // Use model method if available
  if (typeof group.isMember === 'function') {
    return group.isMember(userId);
  }
  
  // Fallback: manual check
  const userIdStr = userId.toString();
  
  // Check owner
  if (isGroupOwner(userId, group)) return true;
  
  // Check moderators
  if (isGroupModerator(userId, group)) return true;
  
  // Check members array
  if (Array.isArray(group.members)) {
    return group.members.some(m => 
      (m._id?.toString() || m.toString()) === userIdStr
    );
  }
  
  return false;
}

/**
 * Check if a user can moderate a group (owner OR moderator)
 * @param {string|ObjectId} userId - User ID to check
 * @param {Object} group - Group document
 * @returns {boolean}
 */
export function canModerateGroup(userId, group) {
  if (!userId || !group) return false;
  
  // Use model method if available
  if (typeof group.canModerate === 'function') {
    return group.canModerate(userId);
  }
  
  // Fallback: owner OR moderator
  return isGroupOwner(userId, group) || isGroupModerator(userId, group);
}

/**
 * Get the user's role in a group
 * @param {string|ObjectId} userId - User ID to check
 * @param {Object} group - Group document
 * @returns {'owner'|'moderator'|'member'|null}
 */
export function getGroupRole(userId, group) {
  if (!userId || !group) return null;
  
  if (isGroupOwner(userId, group)) return 'owner';
  if (isGroupModerator(userId, group)) return 'moderator';
  if (isGroupMember(userId, group)) return 'member';
  
  return null;
}

/**
 * Calculate accurate member count for a group
 * @param {Object} group - Group document
 * @returns {number}
 */
export function getGroupMemberCount(group) {
  if (!group) return 0;
  
  const membersCount = Array.isArray(group.members) ? group.members.length : 0;
  const moderatorsCount = Array.isArray(group.moderators) ? group.moderators.length : 0;
  
  // +1 for owner (owner is separate, not in members/moderators arrays)
  return membersCount + moderatorsCount + 1;
}

