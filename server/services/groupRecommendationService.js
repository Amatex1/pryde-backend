/**
 * Community Gravity Recommendation Service
 *
 * Scores candidate groups for a given user using three signals:
 *
 *   1. Friend membership  (+4 per following who is a member)
 *      "People you follow are in this group"
 *
 *   2. Connected members  (+2 per member shared with groups you already joined)
 *      "People from your communities are also here"
 *
 *   3. Recent activity    (+1.5 per post in the last 7 days)
 *      "This community is actively posting"
 *
 *   4. New group boost    (+10 flat if created within 14 days)
 *      "Fresh community worth discovering"
 *
 * Only listed/public groups that the user has NOT already joined are returned.
 * Returns the top 10 scored groups.
 */

import User  from '../models/User.js';
import Group from '../models/Group.js';
import Post  from '../models/Post.js';

const SEVEN_DAYS_MS   = 7  * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Array<{ group: object, score: number }>>}
 */
export async function recommendGroups(userId) {
  const userIdStr = userId.toString();

  // ── 1. Load user's following list ────────────────────────────────────────
  const user = await User.findById(userId).select('following').lean();
  if (!user) return [];

  const followingSet = new Set(
    (user.following || []).map((id) => id.toString())
  );

  // ── 2. Find groups the user already belongs to (member, moderator, owner) ─
  const joinedGroups = await Group.find({
    $or: [
      { members:    userId },
      { moderators: userId },
      { owner:      userId },
    ],
  }).select('_id members').lean();

  const joinedGroupIds = new Set(joinedGroups.map((g) => g._id.toString()));

  // Collect all member IDs across joined groups → "connected users"
  const connectedUserSet = new Set();
  for (const g of joinedGroups) {
    for (const m of g.members || []) {
      const mid = m.toString();
      if (mid !== userIdStr) connectedUserSet.add(mid);
    }
  }

  // ── 3. Load candidate groups (listed/public, not already joined) ──────────
  const candidates = await Group.find({
    visibility: { $in: ['listed', 'public'] },
    status:     'approved',
    _id:        { $nin: Array.from(joinedGroupIds) },
  })
    .select('_id slug name description members moderators owner coverPhoto createdAt joinMode')
    .lean();

  if (!candidates.length) return [];

  // ── 4. Count recent posts per group in one aggregation ────────────────────
  const since = new Date(Date.now() - SEVEN_DAYS_MS);
  const candidateIds = candidates.map((g) => g._id);

  const postCounts = await Post.aggregate([
    {
      $match: {
        groupId:   { $in: candidateIds },
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id:   '$groupId',
        count: { $sum: 1 },
      },
    },
  ]);

  const postCountMap = new Map(
    postCounts.map(({ _id, count }) => [_id.toString(), count])
  );

  // ── 5. Score each candidate ───────────────────────────────────────────────
  const now = Date.now();

  const scored = candidates.map((group) => {
    let score = 0;

    const memberStrs = (group.members || []).map((m) => m.toString());

    // Signal 1 — friends who are members
    const friendCount = memberStrs.filter((m) => followingSet.has(m)).length;
    score += friendCount * 4;

    // Signal 2 — connected users who are members
    const connectedCount = memberStrs.filter((m) => connectedUserSet.has(m)).length;
    score += connectedCount * 2;

    // Signal 3 — recent post activity
    const recentPosts = postCountMap.get(group._id.toString()) || 0;
    score += recentPosts * 1.5;

    // Signal 4 — new group boost
    const ageMs = now - new Date(group.createdAt).getTime();
    if (ageMs < FOURTEEN_DAYS_MS) {
      score += 10;
    }

    // Computed member count for display
    const memberCount =
      (group.members?.length  || 0) +
      (group.moderators?.length || 0) +
      1; // owner

    return {
      group: {
        _id:         group._id,
        slug:        group.slug,
        name:        group.name,
        description: group.description,
        coverPhoto:  group.coverPhoto,
        joinMode:    group.joinMode,
        createdAt:   group.createdAt,
        memberCount,
      },
      score,
      // Expose scoring breakdown for potential debug use
      signals: {
        friendMembers:    friendCount,
        connectedMembers: connectedCount,
        recentPosts,
        isNew:            ageMs < FOURTEEN_DAYS_MS,
      },
    };
  });

  // ── 6. Sort descending, return top 10 ─────────────────────────────────────
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
