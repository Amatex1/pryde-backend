/**
 * Member Spotlight Job
 * 
 * Creates "Meet a Member" spotlight posts featuring active community members.
 * Runs weekly to highlight different members of the community.
 * 
 * Schedule: Weekly (configurable)
 * 
 * Usage:
 *   import { runMemberSpotlight } from './jobs/memberSpotlightJob.js';
 *   await runMemberSpotlight();
 */

import User from '../models/User.js';
import Post from '../models/Post.js';
import ActivityEvent from '../models/ActivityEvent.js';
import logger from '../utils/logger.js';

/**
 * Get potential spotlight candidates
 * Members who are active but not recently featured
 */
const getSpotlightCandidates = async () => {
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Get users who joined in the last 6 months and have been active
  const candidates = await User.find({
    role: { $nin: ['system', 'prompts', 'founder'] },
    isVerified: true,
    createdAt: { $gte: oneMonthAgo },
    $or: [
      { lastActivityDate: { $gte: oneMonthAgo } },
      { posts: { $exists: true } }
    ]
  })
  .select('_id username displayName bio profilePhoto badges createdAt')
  .limit(50);
  
  // Get recently featured users (last 30 days)
  const recentSpotlights = await ActivityEvent.find({
    type: 'member_spotlight',
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  }).select('userId');
  
  const recentlyFeaturedIds = new Set(recentSpotlights.map(e => e.userId?.toString()));
  
  // Filter out recently featured
  return candidates.filter(c => !recentlyFeaturedIds.has(c._id.toString()));
};

/**
 * Get member stats for spotlight
 */
const getMemberStats = async (userId) => {
  const user = await User.findById(userId).select('username displayName following followersCount');
  
  // Count posts in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const postCount = await Post.countDocuments({
    author: userId,
    createdAt: { $gte: thirtyDaysAgo },
    isAnonymous: { $ne: true }
  });
  
  // Count comments in last 30 days
  const Comment = (await import('../models/Comment.js')).default;
  const commentCount = await Comment.countDocuments({
    user: userId,
    createdAt: { $gte: thirtyDaysAgo }
  });
  
  // Get recent posts for context
  const recentPosts = await Post.find({
    author: userId,
    createdAt: { $gte: thirtyDaysAgo },
    isAnonymous: { $ne: true }
  })
  .sort({ createdAt: -1 })
  .limit(3)
  .select('content createdAt');
  
  return {
    user,
    postCount,
    commentCount,
    recentPosts,
    memberSince: user?.createdAt
  };
};

/**
 * Generate spotlight post content
 */
const generateSpotlightContent = (stats) => {
  const { user, postCount, commentCount, memberSince } = stats;
  const memberSinceDate = new Date(memberSince).toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });
  
  // Get a recent post content snippet
  const recentPost = stats.recentPosts?.[0];
  const postPreview = recentPost?.content 
    ? `"${recentPost.content.substring(0, 100)}${recentPost.content.length > 100 ? '...' : ''}"`
    : null;
  
  const content = `🌟 **Meet a Member: ${user.displayName || user.username}**

Hey community! Let's get to know **@${user.username}** a little better!

${user.bio ? `📝 ${user.bio}` : ''}

**Quick Stats:**
• Member since: ${memberSinceDate}
• Posts: ${postCount}
• Comments: ${commentCount}

${postPreview ? `**Recent post:**\n${postPreview}` : ''}

Thanks for being part of our community, ${user.username}! 💜

#MeetAMember #CommunitySpotlight`;

  return content;
};

/**
 * Create spotlight post
 * Posts as the system account (pryde_prompts or similar)
 */
export const createMemberSpotlight = async () => {
  logger.info('[MemberSpotlight] Starting spotlight selection');
  
  // Get system account to post as
  const systemUser = await User.findOne({ 
    systemRole: 'PROMPTS',
    role: 'system'
  }).select('_id');
  
  if (!systemUser) {
    logger.warn('[MemberSpotlight] No system account found');
    return null;
  }
  
  // Get candidates
  const candidates = await getSpotlightCandidates();
  
  if (candidates.length === 0) {
    logger.info('[MemberSpotlight] No eligible candidates found');
    return null;
  }
  
  // Pick a random candidate
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  
  // Get their stats
  const stats = await getMemberStats(selected._id);
  
  // Generate content
  const content = generateSpotlightContent(stats);
  
  // Create the post
  const Post = (await import('../models/Post.js')).default;
  const post = await Post.create({
    author: systemUser._id,
    content,
    isPinned: true,
    isSystemPost: true,
    systemPostType: 'member_spotlight'
  });
  
  // Log the activity
  await ActivityEvent.create({
    type: 'member_spotlight',
    userId: selected._id,
    postId: post._id,
    systemGenerated: true,
    metadata: {
      spotlightedAt: new Date(),
      postCount: stats.postCount,
      commentCount: stats.commentCount
    }
  });
  
  logger.info(`[MemberSpotlight] Created spotlight for user ${selected.username}`);
  
  return {
    post,
    spotlightedUser: selected
  };
};

/**
 * Run the member spotlight job
 */
export const runMemberSpotlight = async () => {
  try {
    return await createMemberSpotlight();
  } catch (error) {
    logger.error('[MemberSpotlight] Error:', error.message);
    throw error;
  }
};

export default {
  getSpotlightCandidates,
  getMemberStats,
  generateSpotlightContent,
  createMemberSpotlight,
  runMemberSpotlight
};

