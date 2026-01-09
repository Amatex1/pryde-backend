/**
 * Badge Population Utilities
 *
 * Transforms badge IDs into full badge objects for posts, comments, and users
 */

import Badge from '../models/Badge.js';
import User from '../models/User.js';

/**
 * Populate badges for a single user object
 * @param {Object} user - User object with badges array (IDs)
 * @param {Object} options - Options for badge visibility
 * @returns {Object} - User object with populated badges
 */
async function populateUserBadges(user, options = {}) {
  if (!user || !user.badges || user.badges.length === 0) {
    return user;
  }

  // If user has hidden badges, return empty array
  if (user.privacySettings?.hideBadges) {
    user.badges = [];
    return user;
  }

  // Get full badge details
  const allBadges = await Badge.find({
    id: { $in: user.badges },
    isActive: true
  }).lean();

  // Filter badges based on visibility settings
  let visibleBadges = allBadges;

  // If user has configured public badges, show only those + CORE_ROLE badges
  if (user.publicBadges && user.publicBadges.length > 0) {
    visibleBadges = allBadges.filter(badge =>
      badge.category === 'CORE_ROLE' || user.publicBadges.includes(badge.id)
    );
  } else if (user.hiddenBadges && user.hiddenBadges.length > 0) {
    // Otherwise, show all badges except hidden ones
    visibleBadges = allBadges.filter(badge =>
      !user.hiddenBadges.includes(badge.id)
    );
  }

  // Sort by priority
  visibleBadges.sort((a, b) => (a.priority || 100) - (b.priority || 100));

  user.badges = visibleBadges;
  return user;
}

/**
 * Populate badges for an array of posts
 * @param {Array} posts - Array of post objects
 * @returns {Array} - Posts with populated author badges
 */
async function populatePostBadges(posts) {
  if (!posts || posts.length === 0) return posts;

  // Collect all unique user IDs from posts, comments, and replies
  const userIds = new Set();
  
  posts.forEach(post => {
    if (post.author?._id) userIds.add(post.author._id.toString());
    
    // Collect comment author IDs
    if (post.comments) {
      post.comments.forEach(comment => {
        if (comment.user?._id) userIds.add(comment.user._id.toString());
        
        // Collect reply author IDs
        if (comment.replies) {
          comment.replies.forEach(reply => {
            if (reply.user?._id) userIds.add(reply.user._id.toString());
          });
        }
      });
    }
  });

  // Fetch all users with their badge settings
  const users = await User.find({
    _id: { $in: Array.from(userIds) }
  }).select('badges publicBadges hiddenBadges privacySettings.hideBadges').lean();

  // Create a map of userId -> populated badges
  const userBadgesMap = {};
  for (const user of users) {
    const populatedUser = await populateUserBadges(user);
    userBadgesMap[user._id.toString()] = populatedUser.badges;
  }

  // Populate badges in posts
  posts.forEach(post => {
    if (post.author?._id) {
      const userId = post.author._id.toString();
      post.author.badges = userBadgesMap[userId] || [];
    }

    // Populate badges in comments
    if (post.comments) {
      post.comments.forEach(comment => {
        if (comment.user?._id) {
          const userId = comment.user._id.toString();
          comment.user.badges = userBadgesMap[userId] || [];
        }

        // Populate badges in replies
        if (comment.replies) {
          comment.replies.forEach(reply => {
            if (reply.user?._id) {
              const userId = reply.user._id.toString();
              reply.user.badges = userBadgesMap[userId] || [];
            }
          });
        }
      });
    }
  });

  return posts;
}

/**
 * Populate badges for a single post
 * @param {Object} post - Post object
 * @returns {Object} - Post with populated author badges
 */
async function populateSinglePostBadges(post) {
  if (!post) return post;
  const posts = await populatePostBadges([post]);
  return posts[0];
}

export {
  populateUserBadges,
  populatePostBadges,
  populateSinglePostBadges
};

