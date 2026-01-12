/**
 * Feed Ranking Utility
 * 
 * Engagement-based ranking algorithm for posts.
 * Balances recency with engagement to show relevant content.
 * 
 * Ranking Formula:
 * score = (reactions * 2 + comments * 3 + shares * 5) / age_hours^1.5
 * 
 * Higher scores = higher ranking
 */

/**
 * Calculate engagement score for a post
 * 
 * @param {Object} post - Post object
 * @returns {number} Engagement score
 */
export const calculateEngagementScore = (post) => {
  const reactionCount = post.reactionCount || 0;
  const commentCount = post.commentCount || 0;
  const shareCount = post.shareCount || 0;
  
  // Weighted engagement score
  // Comments are worth more than reactions
  // Shares are worth the most
  const engagementScore = (
    reactionCount * 2 +
    commentCount * 3 +
    shareCount * 5
  );
  
  return engagementScore;
};

/**
 * Calculate time decay factor
 * 
 * @param {Date} createdAt - Post creation date
 * @returns {number} Time decay factor (higher = more recent)
 */
export const calculateTimeDecay = (createdAt) => {
  const now = new Date();
  const ageMs = now - new Date(createdAt);
  const ageHours = ageMs / (1000 * 60 * 60);
  
  // Prevent division by zero for very recent posts
  const adjustedAge = Math.max(ageHours, 0.1);
  
  // Time decay: older posts get lower scores
  // Using power of 1.5 for moderate decay
  const decay = Math.pow(adjustedAge, 1.5);
  
  return 1 / decay;
};

/**
 * Calculate final ranking score
 * 
 * @param {Object} post - Post object
 * @returns {number} Ranking score
 */
export const calculateRankingScore = (post) => {
  const engagementScore = calculateEngagementScore(post);
  const timeDecay = calculateTimeDecay(post.createdAt);
  
  // Final score = engagement * time decay
  const score = engagementScore * timeDecay;
  
  return score;
};

/**
 * Rank posts by engagement and recency
 * 
 * @param {Array} posts - Array of post objects
 * @returns {Array} Sorted posts (highest score first)
 */
export const rankPosts = (posts) => {
  return posts
    .map(post => ({
      ...post,
      _rankingScore: calculateRankingScore(post)
    }))
    .sort((a, b) => b._rankingScore - a._rankingScore);
};

/**
 * Get trending posts (high engagement in last 24 hours)
 * 
 * @param {Array} posts - Array of post objects
 * @param {number} limit - Maximum number of trending posts
 * @returns {Array} Trending posts
 */
export const getTrendingPosts = (posts, limit = 10) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const recentPosts = posts.filter(post => 
    new Date(post.createdAt) >= oneDayAgo
  );
  
  const ranked = rankPosts(recentPosts);
  
  return ranked.slice(0, limit);
};

/**
 * Boost posts from followed users
 * 
 * @param {Array} posts - Array of post objects
 * @param {Array} followedUserIds - Array of followed user IDs
 * @param {number} boostFactor - Multiplier for followed users (default: 1.5)
 * @returns {Array} Posts with boosted scores
 */
export const boostFollowedUsers = (posts, followedUserIds, boostFactor = 1.5) => {
  return posts.map(post => {
    const isFollowed = followedUserIds.some(
      id => id.toString() === post.authorId?.toString()
    );
    
    if (isFollowed) {
      return {
        ...post,
        _rankingScore: (post._rankingScore || calculateRankingScore(post)) * boostFactor
      };
    }
    
    return post;
  });
};

/**
 * Diversify feed (prevent same author dominating)
 * 
 * @param {Array} posts - Sorted posts
 * @param {number} maxConsecutive - Max consecutive posts from same author
 * @returns {Array} Diversified posts
 */
export const diversifyFeed = (posts, maxConsecutive = 2) => {
  const result = [];
  const authorCounts = new Map();
  
  for (const post of posts) {
    const authorId = post.authorId?.toString();
    const count = authorCounts.get(authorId) || 0;
    
    if (count < maxConsecutive) {
      result.push(post);
      authorCounts.set(authorId, count + 1);
    } else {
      // Skip this post for now, add to end
      result.push(post);
    }
  }
  
  return result;
};

/**
 * Complete feed ranking pipeline
 * 
 * @param {Array} posts - Raw posts
 * @param {Object} options - Ranking options
 * @returns {Array} Ranked and diversified posts
 */
export const rankFeed = (posts, options = {}) => {
  const {
    followedUserIds = [],
    boostFactor = 1.5,
    diversify = true,
    maxConsecutive = 2
  } = options;
  
  // Step 1: Calculate ranking scores
  let ranked = rankPosts(posts);
  
  // Step 2: Boost followed users
  if (followedUserIds.length > 0) {
    ranked = boostFollowedUsers(ranked, followedUserIds, boostFactor);
    ranked.sort((a, b) => b._rankingScore - a._rankingScore);
  }
  
  // Step 3: Diversify feed
  if (diversify) {
    ranked = diversifyFeed(ranked, maxConsecutive);
  }
  
  return ranked;
};

