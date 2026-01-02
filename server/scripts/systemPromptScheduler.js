/**
 * System Prompt Scheduler
 * 
 * Cron job that posts one system prompt per day (configurable frequency).
 * 
 * Features:
 * - Idempotent: Safe to run multiple times (checks lastPostedAt)
 * - Rotation: Selects oldest prompt to ensure even distribution
 * - Respects global pause setting
 * - Bypasses rate limits (system account)
 * 
 * Post format:
 * - Prompt text
 * - Footer: "You don't have to reply — reading quietly is welcome too."
 */

import cron from 'node-cron';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import SystemPrompt from '../models/SystemPrompt.js';
import SystemConfig from '../models/SystemConfig.js';

// Footer text appended to all system prompt posts
const PROMPT_FOOTER = '\n\n_You don\'t have to reply — reading quietly is welcome too._';

// Minimum hours between posts (prevents duplicate posting if job runs multiple times)
const MIN_HOURS_BETWEEN_POSTS = 20;

/**
 * Check if we can post a new prompt
 * Returns { canPost: boolean, reason?: string }
 */
async function canPostPrompt() {
  // Check if system prompts are enabled
  const enabled = await SystemConfig.getValue('systemPrompts.enabled', true);
  if (!enabled) {
    return { canPost: false, reason: 'System prompts are paused globally' };
  }

  // Check when the last prompt was posted
  const lastPostedAt = await SystemConfig.getValue('systemPrompts.lastPostedAt', null);
  if (lastPostedAt) {
    const hoursSinceLastPost = (Date.now() - new Date(lastPostedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastPost < MIN_HOURS_BETWEEN_POSTS) {
      return { 
        canPost: false, 
        reason: `Only ${hoursSinceLastPost.toFixed(1)} hours since last post (min: ${MIN_HOURS_BETWEEN_POSTS})` 
      };
    }
  }

  return { canPost: true };
}

/**
 * Get the system account user
 */
async function getSystemUser() {
  const user = await User.findOne({ 
    username: 'pryde_prompts', 
    isSystemAccount: true 
  });
  
  if (!user) {
    throw new Error('System account not found. Run seedSystemPrompts first.');
  }
  
  return user;
}

/**
 * Create a post from a system prompt
 */
async function createPromptPost(prompt, systemUser) {
  const postContent = prompt.text + PROMPT_FOOTER;
  
  const post = new Post({
    author: systemUser._id,
    content: postContent,
    visibility: 'public', // System prompts are always public
    isSystemPost: true // Flag for frontend styling
  });
  
  await post.save();
  
  // Update the prompt's lastPostedAt
  await prompt.markAsPosted(post._id);
  
  // Update system config with last posted time
  await SystemConfig.setValue(
    'systemPrompts.lastPostedAt',
    new Date().toISOString(),
    null,
    'When the last system prompt was posted'
  );
  
  return post;
}

/**
 * Main function to post the next system prompt
 */
export async function postNextPrompt() {
  try {
    // Check if DB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('[SystemPrompts] Database not ready, skipping');
      return { success: false, reason: 'Database not connected' };
    }

    // Check if we can post
    const { canPost, reason } = await canPostPrompt();
    if (!canPost) {
      console.log(`[SystemPrompts] Skipping: ${reason}`);
      return { success: false, reason };
    }

    // Get system user
    const systemUser = await getSystemUser();

    // Get next prompt to post
    const prompt = await SystemPrompt.getNextPrompt();
    if (!prompt) {
      console.log('[SystemPrompts] No active prompts available');
      return { success: false, reason: 'No active prompts' };
    }

    // Create the post
    const post = await createPromptPost(prompt, systemUser);
    
    console.log(`[SystemPrompts] ✅ Posted prompt: "${prompt.text.substring(0, 50)}..."`);
    console.log(`[SystemPrompts] Post ID: ${post._id}`);
    
    return { 
      success: true, 
      postId: post._id, 
      promptId: prompt._id,
      promptText: prompt.text 
    };
  } catch (error) {
    console.error('[SystemPrompts] ❌ Error posting prompt:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Start the scheduler
 * Runs at 10:00 AM UTC daily (gentle time for most timezones)
 */
export function startScheduler() {
  console.log('[SystemPrompts] 🕐 Starting scheduler...');
  console.log('[SystemPrompts] 📅 Posts will run daily at 10:00 AM UTC');
  
  // Schedule: 10:00 AM UTC daily
  // Cron format: minute hour day month weekday
  cron.schedule('0 10 * * *', async () => {
    console.log('\n[SystemPrompts] ⏰ Scheduled job triggered');
    await postNextPrompt();
  });
  
  console.log('[SystemPrompts] ✅ Scheduler started');
}

// Export for manual testing
export default { postNextPrompt, startScheduler, canPostPrompt };

