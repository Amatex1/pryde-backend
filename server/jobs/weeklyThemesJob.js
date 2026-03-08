/**
 * Weekly Themes Job
 * 
 * Creates weekly themed discussion posts to encourage community engagement.
 * Different themes each week to spark conversations.
 * 
 * Schedule: Every Monday at 9:00 AM (configurable)
 * 
 * Usage:
 *   import { runWeeklyTheme } from './jobs/weeklyThemesJob.js';
 *   await runWeeklyTheme();
 */

import User from '../models/User.js';
import Post from '../models/Post.js';
import logger from '../utils/logger.js';

/**
 * Weekly themes - rotate through these
 */
const WEEKLY_THEMES = [
  {
    id: 'small-win',
    emoji: '🎉',
    title: 'Small Win Monday',
    prompt: "What small win did you have this week? It doesn't have to be big - every victory counts!",
    hashtags: '#SmallWins #MondayMotivation'
  },
  {
    id: 'grateful-tuesday',
    emoji: '💜',
    title: 'Grateful Tuesday',
    prompt: "What are you grateful for today? Let's fill this thread with positivity!",
    hashtags: '#Grateful #TuesdayThoughts'
  },
  {
    id: 'wellness-wednesday',
    emoji: '🧘',
    title: 'Wellness Wednesday',
    prompt: "How are you taking care of yourself this week? Self-care looks different for everyone.",
    hashtags: '#WellnessWednesday #SelfCare'
  },
  {
    id: 'throwback-thursday',
    emoji: '📸',
    title: 'Throwback Thursday',
    prompt: "Share a memory or photo from your journey. How far have you come?",
    hashtags: '#ThrowbackThursday #Journey'
  },
  {
    id: 'friend-friday',
    emoji: '🤝',
    title: 'Friend Friday',
    prompt: "Who in the community has made a difference for you? Tag them or share why they matter!",
    hashtags: '#Community #Grateful'
  },
  {
    id: 'weekend Plans',
    emoji: '🌟',
    title: 'Weekend Plans',
    prompt: "What are you looking forward to this weekend? Big or small - we want to know!",
    hashtags: '#WeekendVibes #Plans'
  },
  {
    id: 'reflection-sunday',
    emoji: '🌈',
    title: 'Reflection Sunday',
    prompt: "How was your week? What did you learn? There's no wrong answer here.",
    hashtags: '#SundayReflection #WeeklyCheckIn'
  }
];

/**
 * Get the theme for this week
 */
const getWeeklyTheme = () => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  
  // Rotate through themes based on week number
  const themeIndex = weekNumber % WEEKLY_THEMES.length;
  return WEEKLY_THEMES[themeIndex];
};

/**
 * Get system account to post as
 */
const getSystemAccount = async () => {
  const systemUser = await User.findOne({ 
    systemRole: 'PROMPTS',
    role: 'system'
  }).select('_id');
  
  if (!systemUser) {
    // Fallback to first founder/admin
    const fallback = await User.findOne({ 
      role: { $in: ['founder', 'admin'] }
    }).select('_id');
    return fallback;
  }
  
  return systemUser;
};

/**
 * Check if this week's theme was already posted
 */
const wasThemePostedThisWeek = async (themeId) => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const Post = (await import('../models/Post.js')).default;
  const existing = await Post.findOne({
    systemPostType: 'weekly_theme',
    metadata: { themeId },
    createdAt: { $gte: startOfWeek }
  });
  
  return !!existing;
};

/**
 * Generate theme post content
 */
const generateThemePost = (theme) => {
  return `${theme.emoji} **${theme.title}**

${theme.prompt}

${theme.hashtags}

---
💜 A weekly community prompt from Pryde`;
};

/**
 * Create weekly theme post
 */
export const createWeeklyThemePost = async () => {
  const theme = getWeeklyTheme();
  
  // Check if already posted this week
  const alreadyPosted = await wasThemePostedThisWeek(theme.id);
  if (alreadyPosted) {
    logger.info(`[WeeklyTheme] Theme "${theme.id}" already posted this week`);
    return null;
  }
  
  // Get system account
  const systemAccount = await getSystemAccount();
  if (!systemAccount) {
    logger.warn('[WeeklyTheme] No system account found');
    return null;
  }
  
  // Create the post
  const Post = (await import('../models/Post.js')).default;
  const content = generateThemePost(theme);
  
  const post = await Post.create({
    author: systemAccount._id,
    content,
    isPinned: true,
    isSystemPost: true,
    systemPostType: 'weekly_theme',
    metadata: {
      themeId: theme.id,
      themeTitle: theme.title,
      postedAt: new Date()
    }
  });
  
  logger.info(`[WeeklyTheme] Created weekly theme post: "${theme.title}"`);
  
  return {
    post,
    theme
  };
};

/**
 * Get upcoming themes
 */
export const getUpcomingThemes = (count = 4) => {
  const currentIndex = WEEKLY_THEMES.findIndex(t => t.id === getWeeklyTheme().id);
  
  const themes = [];
  for (let i = 1; i <= count; i++) {
    const index = (currentIndex + i) % WEEKLY_THEMES.length;
    themes.push(WEEKLY_THEMES[index]);
  }
  
  return themes;
};

/**
 * Run the weekly themes job
 */
export const runWeeklyTheme = async () => {
  try {
    const result = await createWeeklyThemePost();
    
    if (result) {
      return {
        success: true,
        theme: result.theme,
        postId: result.post._id
      };
    }
    
    return {
      success: false,
      reason: 'already_posted'
    };
  } catch (error) {
    logger.error('[WeeklyTheme] Error:', error.message);
    throw error;
  }
};

export default {
  WEEKLY_THEMES,
  getWeeklyTheme,
  getUpcomingThemes,
  createWeeklyThemePost,
  runWeeklyTheme
};

