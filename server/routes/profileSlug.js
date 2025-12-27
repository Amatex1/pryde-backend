import express from 'express';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Reserved slugs that cannot be used as profile URLs
const RESERVED_SLUGS = [
  'settings',
  'login',
  'register',
  'admin',
  'messages',
  'groups',
  'explore',
  'discover',
  'feed',
  'notifications',
  'events',
  'search',
  'api',
  'auth',
  'privacy',
  'security',
  'help',
  'about',
  'terms',
  'legal',
  'support',
  'profile',
  'user',
  'users',
  'home',
  'logout',
  'bookmarks',
  'journal',
  'longform',
  'photo-essay',
  'lounge',
  'invite',
  'invites'
];

/**
 * Validate slug format:
 * - 3-30 characters
 * - lowercase letters, numbers, underscores only
 * - not a reserved word
 */
const isValidSlug = (slug) => {
  if (!slug || typeof slug !== 'string') return false;
  const normalized = slug.toLowerCase().trim();
  return /^[a-z0-9_]{3,30}$/.test(normalized) && !RESERVED_SLUGS.includes(normalized);
};

/**
 * @route   GET /api/profile-slug/check/:slug
 * @desc    Check if a profile slug is available
 * @access  Public
 */
router.get('/check/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase().trim();

    if (!isValidSlug(slug)) {
      return res.json({ 
        available: false, 
        reason: 'invalid',
        message: 'URL must be 3-30 characters, using only letters, numbers, and underscores'
      });
    }

    // Check if slug matches any existing username
    const usernameExists = await User.exists({ 
      username: { $regex: new RegExp(`^${slug}$`, 'i') }
    });
    
    if (usernameExists) {
      return res.json({ 
        available: false, 
        reason: 'taken',
        message: 'This URL is already in use'
      });
    }

    // Check if slug is already taken as a profileSlug
    const slugExists = await User.exists({ profileSlug: slug });

    res.json({ 
      available: !slugExists,
      reason: slugExists ? 'taken' : null,
      message: slugExists ? 'This URL is already in use' : null
    });
  } catch (error) {
    console.error('Check slug error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /api/profile-slug/set
 * @desc    Set or update user's custom profile slug
 * @access  Private
 */
router.post('/set', auth, async (req, res) => {
  try {
    const { slug } = req.body;
    const normalizedSlug = slug?.toLowerCase().trim();

    if (!isValidSlug(normalizedSlug)) {
      return res.status(400).json({ 
        error: 'Invalid URL format',
        message: 'URL must be 3-30 characters, using only letters, numbers, and underscores'
      });
    }

    // Check if slug matches any existing username (case-insensitive)
    const usernameExists = await User.exists({ 
      username: { $regex: new RegExp(`^${normalizedSlug}$`, 'i') },
      _id: { $ne: req.userId }
    });
    
    if (usernameExists) {
      return res.status(409).json({ 
        error: 'URL unavailable',
        message: 'This URL is already in use by another user'
      });
    }

    // Check if slug is already taken by another user
    const existingUser = await User.findOne({ 
      profileSlug: normalizedSlug,
      _id: { $ne: req.userId }
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: 'URL already taken',
        message: 'This URL is already in use by another user'
      });
    }

    // Update user's profile slug
    const user = await User.findByIdAndUpdate(
      req.userId,
      { profileSlug: normalizedSlug },
      { new: true }
    ).select('profileSlug username');

    res.json({ 
      success: true, 
      slug: user.profileSlug,
      message: 'Profile URL updated successfully'
    });
  } catch (error) {
    console.error('Set slug error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/profile-slug
 * @desc    Remove user's custom profile slug
 * @access  Private
 */
router.delete('/', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { $unset: { profileSlug: 1 } });
    res.json({ success: true, message: 'Profile URL removed' });
  } catch (error) {
    console.error('Delete slug error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

