/**
 * Feed Ranking System - CALM EDITION
 * 
 * Gentle community activity signals that make the feed feel alive
 * without aggressive engagement algorithms.
 * 
 * Maintains Pryde's calm philosophy - no trending, viral, or urgency mechanics.
 * 
 * Ranking Score Formula:
 * score = recencyWeight + commentActivity + mildEngagement + relationshipWeight
 * 
 * Features:
 * - Active Conversations: Posts with 3+ comments in last 6 hours
 * - Ongoing Discussions: Posts with 5+ comments spread over time
 * - New Member Boost: Gentle boost for accounts < 7 days
 * - Author Diversity: Max 2 posts per author in top 10
 * - Community Moments: Fill gaps with active older posts
 * - Activity Tags: Visual indicators for feed activity
 */

// Weight configuration - RECENCY DOMINATES
const WEIGHTS = {
  recency: 0.40,        // 40% - recency is primary
  mildEngagement: 0.15,  // 15% - gentle engagement (not viral)
  relationship: 0.15,   // 15% - author relationship
  authorDiversity: 0.10, // 10% - prevent domination
  communityMoment: 0.10, // 10% - fill gaps
  newMemberBoost: 0.05,  // 5% - gentle new user boost
  contentQuality: 0.05   // 5% - media presence
};

// Time constants
const HOUR_IN_MS = 60 * 60 * 1000;
const SIX_HOURS = 6 * HOUR_IN_MS;
const FORTY_EIGHT_HOURS = 48 * HOUR_IN_MS;
const ONE_WEEK = 7 * 24 * HOUR_IN_MS;

/**
 * Calculate recency score (exponential decay)
 * Primary factor - dominates ranking
 * @param {Date} createdAt - Post creation time
 * @returns {number} Score 0-1
 */
const calculateRecencyScore = (createdAt) => {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / HOUR_IN_MS;
  // Slower decay - half-life of 12 hours for calm feel
  return Math.exp(-ageHours / 12);
};

/**
 * Calculate MILD engagement score
 * No viral amplification - capped to prevent domination
 * @param {object} post - Post object
 * @returns {number} Score 0-0.15 (capped)
 */
const calculateMildEngagementScore = (post) => {
  const likes = post.likes?.length || 0;
  const comments = post.commentCount || 0;
  
  // Capped engagement - cannot dominate recency
  const rawScore = (Math.log10(likes + 1) / 4) * 0.15;
  return Math.min(0.15, rawScore);
};

/**
 * Calculate relationship score
 * @param {string} authorId - Post author ID
 * @param {object} currentUser - Current user's following/connections
 * @returns {number} Score 0-1
 */
const calculateRelationshipScore = (authorId, currentUser) => {
  if (!currentUser) return 0.1;
  
  const following = currentUser.following || [];
  const friends = currentUser.friends || [];
  
  if (friends.includes(authorId)) return 1.0;
  if (following.includes(authorId)) return 0.7;
  return 0.1;
};

/**
 * Calculate author diversity score
 * Penalize authors with multiple posts in top results
 * @param {string} authorId - Post author ID
 * @param {array} authorCounts - Map of author ID to post count
 * @param {number} position - Position in feed
 * @returns {number} Penalty 0-0.1
 */
const calculateDiversityScore = (authorId, authorCounts, position) => {
  if (!authorCounts || position >= 10) return 0;
  
  const count = authorCounts[authorId] || 0;
  
  // Max 2 posts per author in top 10
  if (count >= 2) return 0.1;
  if (count >= 1) return 0.05;
  
  return 0;
};

/**
 * Calculate new member boost
 * Gentle boost for new users (account < 7 days)
 * @param {object} author - Author user object
 * @returns {number} Boost 0-0.05
 */
const calculateNewMemberBoost = (author) => {
  if (!author?.createdAt) return 0;
  
  const accountAge = Date.now() - new Date(author.createdAt).getTime();
  
  // Boost for accounts less than 7 days old
  if (accountAge < ONE_WEEK) {
    // Decreasing boost as account gets older
    const daysOld = accountAge / (24 * HOUR_IN_MS);
    return 0.05 * (1 - daysOld / 7);
  }
  
  return 0;
};

/**
 * Calculate content quality score
 * @param {object} post - Post object
 * @returns {number} Score 0-1
 */
const calculateContentQuality = (post) => {
  let score = 0.3;
  
  if (post.images?.length > 0) score += 0.3;
  if (post.videos?.length > 0) score += 0.3;
  if (post.content?.length > 280) score += 0.1;
  
  return Math.min(1, score);
};

/**
 * Detect Active Conversation
 * Posts with 3+ comments in last 6 hours
 * @param {object} post - Post object
 * @returns {boolean}
 */
const isActiveConversation = (post) => {
  const commentCount = post.commentCount || 0;
  if (commentCount < 3) return false;
  
  // Check if recent comments exist
  const lastCommentTime = post.lastCommentAt;
  if (!lastCommentTime) return false;
  
  const hoursSinceLastComment = (Date.now() - new Date(lastCommentTime).getTime()) / HOUR_IN_MS;
  return hoursSinceLastComment < 6;
};

/**
 * Detect Ongoing Discussion
 * Posts with 5+ comments spread over > 1 hour
 * @param {object} post - Post object
 * @returns {boolean}
 */
const isOngoingDiscussion = (post) => {
  const commentCount = post.commentCount || 0;
  if (commentCount < 5) return false;
  
  // Check comment time spread
  const firstCommentTime = post.firstCommentAt;
  const lastCommentTime = post.lastCommentAt;
  
  if (!firstCommentTime || !lastCommentTime) return false;
  
  const spreadHours = (new Date(lastCommentTime) - new Date(firstCommentTime)) / HOUR_IN_MS;
  return spreadHours > 1;
};

/**
 * Detect New Member Post
 * Posts from users with account < 7 days
 * @param {object} author - Author object
 * @returns {boolean}
 */
const isNewMember = (author) => {
  if (!author?.createdAt) return false;
  
  const accountAge = Date.now() - new Date(author.createdAt).getTime();
  return accountAge < ONE_WEEK;
};

/**
 * Detect Community Moment
 * Posts from past 48 hours with 2+ comments (for filling gaps)
 * @param {object} post - Post object
 * @returns {boolean}
 */
const isCommunityMoment = (post) => {
  const age = Date.now() - new Date(post.createdAt).getTime();
  const commentCount = post.commentCount || 0;
  
  return age < FORTY_EIGHT_HOURS && commentCount >= 2;
};

/**
 * Determine activity tag for post
 * @param {object} post - Post object
 * @returns {string|null}
 */
const getActivityTag = (post) => {
  if (isActiveConversation(post)) return 'active';
  if (isOngoingDiscussion(post)) return 'discussion';
  if (isNewMember(post.author)) return 'newMember';
  if (isCommunityMoment(post)) return 'communityMoment';
  return null;
};

/**
 * Main ranking function - CALM EDITION
 * @param {object} post - Post to rank
 * @param {object} currentUser - Current authenticated user
 * @param {number} feedPosition - Position in feed
 * @param {object} authorCounts - Map of author posts in top results
 * @returns {object} { score, activityTag }
 */
export const calculateFeedScore = (post, currentUser, feedPosition = 0, authorCounts = {}) => {
  if (!post) return { score: 0, activityTag: null };
  
  const authorId = post.author?._id || post.author;
  
  // Calculate component scores
  const recencyScore = calculateRecencyScore(post.createdAt) * WEIGHTS.recency;
  const engagementScore = calculateMildEngagementScore(post) * WEIGHTS.mildEngagement;
  const relationshipScore = calculateRelationshipScore(authorId, currentUser) * WEIGHTS.relationship;
  const diversityPenalty = calculateDiversityScore(authorId, authorCounts, feedPosition) * WEIGHTS.authorDiversity;
  const newMemberBoost = calculateNewMemberBoost(post.author) * WEIGHTS.newMemberBoost;
  const qualityScore = calculateContentQuality(post) * WEIGHTS.contentQuality;
  
  // Community moment boost (only if feed is small)
  let communityBoost = 0;
  if (feedPosition > 15 && isCommunityMoment(post)) {
    communityBoost = WEIGHTS.communityMoment * 0.5;
  }
  
  // Calculate final score
  const totalScore = 
    recencyScore +
    engagementScore +
    relationshipScore -
    diversityPenalty +
    newMemberBoost +
    qualityScore +
    communityBoost;
  
  // Get activity tag
  const activityTag = getActivityTag(post);
  
  return {
    score: totalScore,
    activityTag
  };
};

/**
 * Sort posts by CALM ranking score
 * @param {array} posts - Array of posts to sort
 * @param {object} currentUser - Current authenticated user
 * @returns {array} Sorted posts with activityTags
 */
export const rankPosts = (posts, currentUser) => {
  if (!posts || posts.length === 0) return [];
  
  // Count author occurrences for diversity
  const authorCounts = {};
  
  // Calculate scores for all posts
  const scoredPosts = posts.map((post, index) => {
    const authorId = post.author?._id || post.author;
    
    // Track author counts for diversity (top 10 only)
    if (index < 10) {
      authorCounts[authorId] = (authorCounts[authorId] || 0) + 1;
    }
    
    // Calculate score
    const { score, activityTag } = calculateFeedScore(post, currentUser, index, authorCounts);
    
    return {
      post,
      score,
      activityTag
    };
  });
  
  // Sort by score descending
  scoredPosts.sort((a, b) => b.score - a.score);
  
  // Return sorted posts with activity tags
  return scoredPosts.map(sp => ({
    ...sp.post,
    activityTag: sp.activityTag
  }));
};

/**
 * Check if feed should show conversation header
 * @param {array} posts - Posts with activityTags
 * @returns {boolean}
 */
export const shouldShowConversationHeader = (posts) => {
  if (!posts || posts.length < 2) return false;
  
  const activeCount = posts.filter(p => p.activityTag === 'active').length;
  return activeCount >= 2;
};

/**
 * Get conversation header text
 * @param {array} posts - Posts with activityTags
 * @returns {string}
 */
export const getFeedHeader = (posts) => {
  if (shouldShowConversationHeader(posts)) {
    return '🌿 Conversations happening now';
  }
  return null; // Normal chronological feed
};

/**
 * Inject community moments if feed is small
 * @param {array} posts - Current ranked posts
 * @param {array} allPosts - All available posts (for finding community moments)
 * @returns {array} Feed with community moments if needed
 */
export const injectCommunityMoments = (posts, allPosts) => {
  if (!posts || posts.length >= 10) return posts;
  
  // Find community moments not already in feed
  const existingIds = new Set(posts.map(p => p._id?.toString()));
  const communityMoments = (allPosts || [])
    .filter(p => !existingIds.has(p._id?.toString()))
    .filter(p => isCommunityMoment(p))
    .slice(0, 3); // Max 3 community moments
  
  if (communityMoments.length === 0) return posts;
  
  // Mark as community moments and insert
  const taggedMoments = communityMoments.map(p => ({
    ...p,
    activityTag: 'communityMoment'
  }));
  
  // Insert after position 5
  return [
    ...posts.slice(0, 5),
    ...taggedMoments,
    ...posts.slice(5)
  ];
};

export default {
  calculateFeedScore,
  rankPosts,
  shouldShowConversationHeader,
  getFeedHeader,
  injectCommunityMoments,
  WEIGHTS,
  // Export helpers for testing
  isActiveConversation,
  isOngoingDiscussion,
  isNewMember,
  isCommunityMoment,
  getActivityTag
};
