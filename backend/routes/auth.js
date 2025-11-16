import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authMiddleware } from '../utils/authMiddleware.js';

const router = express.Router();

/**
 * POST /signup
 * Register a new user
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, display_name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      display_name: display_name || email.split('@')[0]
    });

    // Generate token
    const jwtSecret = process.env.JWT_SECRET || 'secret_dev_key';
    const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '30d' });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * POST /login
 * Authenticate user and return token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.banned) {
      return res.status(403).json({ error: 'User is banned' });
    }

    // Generate token
    const jwtSecret = process.env.JWT_SECRET || 'secret_dev_key';
    const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        bio: user.bio
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

/**
 * GET /me
 * Get current user profile
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        email: req.user.email,
        display_name: req.user.display_name,
        avatar_url: req.user.avatar_url,
        bio: req.user.bio
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

export default router;
