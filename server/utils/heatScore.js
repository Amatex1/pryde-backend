/**
 * Heat Score Utility
 *
 * Ranks posts by engagement intensity with a recency decay.
 *
 * Fields are computed from the actual Post model:
 *   - likes[]        → ObjectId array
 *   - comments[]     → embedded array with .user and .createdAt
 *   - createdAt      → post creation date
 *
 * Score formula:
 *   likes × 1  +  comments × 3  +  uniqueParticipants × 2  +  recencyBoost
 *
 * recencyBoost: up to +10 for activity within the last 10 hours, decaying
 * linearly to 0 at 10 hours since last comment (or post creation).
 */

/**
 * Derive the timestamp of the most recent comment on a post.
 * Falls back to post.createdAt when there are no comments.
 *
 * @param {object} post  - Plain Mongoose document (or lean object)
 * @returns {Date}
 */
function getLastActivityDate(post) {
  const comments = post.comments;
  if (!Array.isArray(comments) || comments.length === 0) {
    return new Date(post.createdAt);
  }
  // Find the newest comment by createdAt
  let latest = new Date(comments[0].createdAt || post.createdAt);
  for (let i = 1; i < comments.length; i++) {
    const d = new Date(comments[i].createdAt || post.createdAt);
    if (d > latest) latest = d;
  }
  return latest;
}

/**
 * Count how many distinct users have commented on a post.
 *
 * @param {object} post
 * @returns {number}
 */
function countUniqueParticipants(post) {
  const comments = post.comments;
  if (!Array.isArray(comments) || comments.length === 0) return 0;
  const seen = new Set();
  for (const c of comments) {
    const uid = c.user?.toString?.() || String(c.user);
    if (uid) seen.add(uid);
  }
  return seen.size;
}

/**
 * Calculate the heat score for a single post.
 *
 * @param {object} post  - Mongoose document or lean object
 * @returns {number}
 */
export function calculateHeatScore(post) {
  const likes              = Array.isArray(post.likes)    ? post.likes.length    : 0;
  const comments           = Array.isArray(post.comments) ? post.comments.length : 0;
  const uniqueParticipants = countUniqueParticipants(post);

  const lastActivity  = getLastActivityDate(post);
  const hoursSince    = (Date.now() - lastActivity.getTime()) / 3_600_000;
  const recencyBoost  = Math.max(0, 10 - hoursSince);

  return (
    (likes              * 1) +
    (comments           * 3) +
    (uniqueParticipants * 2) +
    recencyBoost
  );
}

export default calculateHeatScore;
