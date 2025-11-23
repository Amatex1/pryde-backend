import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import auth from '../middleware/auth.js';

// @route   GET /api/users/search
// @desc    Search users
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.json([]);
    }

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } }
      ],
      _id: { $ne: req.userId } // Exclude current user
    })
    .select('username displayName profilePhoto bio')
    .limit(20);

    res.json(users);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('friends', 'username displayName profilePhoto');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const {
      fullName,
      displayName,
      nickname,
      pronouns,
      customPronouns,
      gender,
      customGender,
      relationshipStatus,
      bio,
      location,
      website,
      socialLinks
    } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (fullName !== undefined) user.fullName = fullName;
    if (displayName !== undefined) user.displayName = displayName;
    if (nickname !== undefined) user.nickname = nickname;
    if (pronouns !== undefined) user.pronouns = pronouns;
    if (customPronouns !== undefined) user.customPronouns = customPronouns;
    if (gender !== undefined) user.gender = gender;
    if (customGender !== undefined) user.customGender = customGender;
    if (relationshipStatus !== undefined) user.relationshipStatus = relationshipStatus;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    if (socialLinks !== undefined) user.socialLinks = socialLinks;

    await user.save();

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
