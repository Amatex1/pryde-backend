/**
 * Life-Signal Feature 1: Reflection Prompts Routes
 * 
 * Admin-only prompt management with public active prompt endpoint.
 * - No tracking of responses
 * - No streaks
 * - No engagement stats
 */

import express from 'express';
import ReflectionPrompt from '../models/ReflectionPrompt.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { sanitizeFields } from '../middleware/sanitize.js';

const router = express.Router();

// Middleware to check admin role
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('role');
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Authorization check failed' });
  }
};

// @route   GET /api/prompts/active
// @desc    Get the currently active prompt (if user has prompts enabled)
// @access  Private
router.get('/active', authenticateToken, async (req, res) => {
  try {
    // Check if user has prompts enabled
    const user = await User.findById(req.user.id).select('reflectionPromptsEnabled dismissedPrompts');
    
    if (!user.reflectionPromptsEnabled) {
      return res.json({ prompt: null, enabled: false });
    }
    
    const activePrompt = await ReflectionPrompt.findOne({ active: true });
    
    if (!activePrompt) {
      return res.json({ prompt: null, enabled: true });
    }
    
    // Check if user has already dismissed this prompt
    const isDismissed = user.dismissedPrompts?.some(
      d => d.promptId?.toString() === activePrompt._id.toString()
    );
    
    if (isDismissed) {
      return res.json({ prompt: null, enabled: true, dismissed: true });
    }
    
    res.json({
      prompt: {
        id: activePrompt._id,
        text: activePrompt.text,
        cadence: activePrompt.cadence
      },
      enabled: true
    });
  } catch (error) {
    console.error('Get active prompt error:', error);
    res.status(500).json({ message: 'Failed to fetch active prompt' });
  }
});

// @route   POST /api/prompts/dismiss/:promptId
// @desc    Dismiss a prompt (skip for now)
// @access  Private
router.post('/dismiss/:promptId', authenticateToken, async (req, res) => {
  try {
    const { promptId } = req.params;
    
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        dismissedPrompts: {
          promptId,
          dismissedAt: new Date()
        }
      }
    });
    
    res.json({ message: 'Prompt dismissed' });
  } catch (error) {
    console.error('Dismiss prompt error:', error);
    res.status(500).json({ message: 'Failed to dismiss prompt' });
  }
});

// @route   PATCH /api/prompts/preferences
// @desc    Update prompt preferences (enable/disable)
// @access  Private
router.patch('/preferences', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;
    
    await User.findByIdAndUpdate(req.user.id, {
      reflectionPromptsEnabled: enabled
    });
    
    res.json({ message: 'Preferences updated', enabled });
  } catch (error) {
    console.error('Update prompt preferences error:', error);
    res.status(500).json({ message: 'Failed to update preferences' });
  }
});

// ============================================================================
// Admin Routes
// ============================================================================

// @route   GET /api/prompts/all
// @desc    Get all prompts (admin only)
// @access  Admin
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const prompts = await ReflectionPrompt.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'username displayName');
    
    res.json(prompts);
  } catch (error) {
    console.error('Get all prompts error:', error);
    res.status(500).json({ message: 'Failed to fetch prompts' });
  }
});

// @route   POST /api/prompts
// @desc    Create a new prompt (admin only)
// @access  Admin
router.post('/', authenticateToken, requireAdmin, sanitizeFields(['text']), async (req, res) => {
  try {
    const { text, cadence, active } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Prompt text is required' });
    }

    const prompt = new ReflectionPrompt({
      text: text.trim(),
      cadence: cadence || 'daily',
      active: active || false,
      createdBy: req.user.id
    });

    await prompt.save();

    res.status(201).json(prompt);
  } catch (error) {
    console.error('Create prompt error:', error);
    res.status(500).json({ message: 'Failed to create prompt' });
  }
});

// @route   PATCH /api/prompts/:id/activate
// @desc    Activate a prompt (deactivates all others)
// @access  Admin
router.patch('/:id/activate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const prompt = await ReflectionPrompt.findById(id);
    if (!prompt) {
      return res.status(404).json({ message: 'Prompt not found' });
    }

    prompt.active = true;
    await prompt.save(); // Pre-save hook deactivates others

    res.json({ message: 'Prompt activated', prompt });
  } catch (error) {
    console.error('Activate prompt error:', error);
    res.status(500).json({ message: 'Failed to activate prompt' });
  }
});

// @route   DELETE /api/prompts/:id
// @desc    Delete a prompt (admin only)
// @access  Admin
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const prompt = await ReflectionPrompt.findByIdAndDelete(id);
    if (!prompt) {
      return res.status(404).json({ message: 'Prompt not found' });
    }

    res.json({ message: 'Prompt deleted' });
  } catch (error) {
    console.error('Delete prompt error:', error);
    res.status(500).json({ message: 'Failed to delete prompt' });
  }
});

export default router;

