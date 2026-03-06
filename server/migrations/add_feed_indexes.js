/**
 * Feed Query Indexes
 * 
 * Creates compound indexes to optimize feed queries:
 * - author + visibility + groupId + createdAt (for home/following feed)
 * - visibility + createdAt (for global feed)
 * - author + createdAt (for user profile feed)
 */

import mongoose from 'mongoose';
import Post from '../models/Post.js';
import logger from '../utils/logger.js';

export const addFeedIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    
    logger.info('[IndexMigration] Starting feed index creation...');
    
    // Index 1: Home/Following feed - author + visibility + groupId + createdAt
    // Covers: Feed queries filtering by followed users with visibility and groupId
    await postsCollection.createIndex(
      { author: 1, visibility: 1, groupId: 1, createdAt: -1 },
      { 
        name: 'feed_home_following',
        background: true,
        partialFilterExpression: { visibility: { $in: ['public', 'followers'] } }
      }
    );
    logger.info('[IndexMigration] ✅ Created index: feed_home_following');
    
    // Index 2: Global feed - visibility + createdAt + groupId
    // Covers: Public posts feed without author filtering
    await postsCollection.createIndex(
      { visibility: 1, createdAt: -1, groupId: 1 },
      { 
        name: 'feed_global',
        background: true,
        partialFilterExpression: { visibility: 'public', groupId: null }
      }
    );
    logger.info('[IndexMigration] ✅ Created index: feed_global');
    
    // Index 3: User profile feed - author + createdAt
    // Covers: Posts by specific user
    await postsCollection.createIndex(
      { author: 1, createdAt: -1 },
      { name: 'feed_user_profile', background: true }
    );
    logger.info('[IndexMigration] ✅ Created index: feed_user_profile');
    
    // Index 4: Trending/Engagement - likes count + createdAt
    // Covers: Queries for trending posts
    await postsCollection.createIndex(
      { likesCount: -1, createdAt: -1 },
      { 
        name: 'feed_trending',
        background: true,
        partialFilterExpression: { likesCount: { $gt: 0 } }
      }
    );
    logger.info('[IndexMigration] ✅ Created index: feed_trending');
    
    // Index 5: Comments by post - post + createdAt
    // Covers: Fetching comments for a post
    await postsCollection.createIndex(
      { parentPost: 1, createdAt: -1 },
      { name: 'comments_by_post', background: true }
    );
    logger.info('[IndexMigration] ✅ Created index: comments_by_post');
    
    // Index 6: Compound for feed invalidation - author + createdAt
    // Covers: Invalidating user's posts when they create new content
    await postsCollection.createIndex(
      { author: 1, createdAt: -1 },
      { name: 'invalidation_author', background: true }
    );
    logger.info('[IndexMigration] ✅ Created index: invalidation_author');
    
    logger.info('[IndexMigration] ✅ All feed indexes created successfully!');
    
    return {
      success: true,
      message: 'Feed indexes created successfully'
    };
    
  } catch (error) {
    logger.error('[IndexMigration] ❌ Failed to create feed indexes:', error);
    throw error;
  }
};

// Run if executed directly
const run = async () => {
  // Import db connection
  const { connectDB } = await import('../utils/dbManager.js');
  const config = (await import('../config/config.js')).default;
  
  await connectDB(config.mongoURI);
  
  await addFeedIndexes();
  
  console.log('Index migration complete!');
  process.exit(0);
};

// Check if this is being run directly
if (process.argv[1] === import.meta.url) {
  run();
}

export default { addFeedIndexes };
