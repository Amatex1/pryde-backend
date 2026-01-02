/**
 * System Prompts Admin Routes
 * 
 * Admin-only endpoints for managing rotating system prompts.
 * - CRUD for prompts
 * - Global pause/resume
 * - Manual post trigger (for testing)
 */

import express from 'express';
import User from '../models/User.js';
import SystemPrompt from '../models/SystemPrompt.js';
import SystemConfig from '../models/SystemConfig.js';
import { authenticateToken } from '../middleware/auth.js';
import { sanitizeFields } from '../middleware/sanitize.js';
import { postNextPrompt } from '../scripts/systemPromptScheduler.js';

const router = express.Router();

// Middleware to check admin role
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('role');
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Authorization check failed' });
  }
};

// ============================================================================
// Public Endpoint (for feed display)
// ============================================================================

// @route   GET /api/system-prompts/account
// @desc    Get the system account info for frontend display
// @access  Private
router.get('/account', authenticateToken, async (req, res) => {
  try {
    const systemUser = await User.findOne({ 
      username: 'pryde_prompts', 
      isSystemAccount: true 
    }).select('_id username displayName profilePhoto isSystemAccount');
    
    if (!systemUser) {
      return res.json({ account: null });
    }
    
    res.json({ account: systemUser });
  } catch (error) {
    console.error('Get system account error:', error);
    res.status(500).json({ message: 'Failed to fetch system account' });
  }
});

// ============================================================================
// Admin Routes
// ============================================================================

// @route   GET /api/system-prompts
// @desc    Get all system prompts (admin only)
// @access  Admin
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const prompts = await SystemPrompt.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'username displayName');
    
    // Get global settings
    const enabled = await SystemConfig.getValue('systemPrompts.enabled', true);
    const lastPostedAt = await SystemConfig.getValue('systemPrompts.lastPostedAt', null);
    const frequency = await SystemConfig.getValue('systemPrompts.frequency', 24);
    
    res.json({
      prompts,
      settings: {
        enabled,
        lastPostedAt,
        frequency
      }
    });
  } catch (error) {
    console.error('Get system prompts error:', error);
    res.status(500).json({ message: 'Failed to fetch prompts' });
  }
});

// @route   POST /api/system-prompts
// @desc    Create a new system prompt (admin only)
// @access  Admin
router.post('/', authenticateToken, requireAdmin, sanitizeFields(['text']), async (req, res) => {
  try {
    const { text, category, isActive } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Prompt text is required' });
    }

    const prompt = new SystemPrompt({
      text: text.trim(),
      category: category || 'general',
      isActive: isActive !== false,
      createdBy: req.user.id
    });

    await prompt.save();
    res.status(201).json(prompt);
  } catch (error) {
    console.error('Create system prompt error:', error);
    res.status(500).json({ message: 'Failed to create prompt' });
  }
});

// @route   PATCH /api/system-prompts/:id
// @desc    Update a system prompt (admin only)
// @access  Admin
router.patch('/:id', authenticateToken, requireAdmin, sanitizeFields(['text']), async (req, res) => {
  try {
    const { id } = req.params;
    const { text, category, isActive } = req.body;

    const prompt = await SystemPrompt.findById(id);
    if (!prompt) {
      return res.status(404).json({ message: 'Prompt not found' });
    }

    if (text !== undefined) prompt.text = text.trim();
    if (category !== undefined) prompt.category = category;
    if (isActive !== undefined) prompt.isActive = isActive;

    await prompt.save();
    res.json(prompt);
  } catch (error) {
    console.error('Update system prompt error:', error);
    res.status(500).json({ message: 'Failed to update prompt' });
  }
});

// @route   DELETE /api/system-prompts/:id
// @desc    Delete a system prompt (admin only)
// @access  Admin
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const prompt = await SystemPrompt.findByIdAndDelete(id);
    if (!prompt) {
      return res.status(404).json({ message: 'Prompt not found' });
    }

    res.json({ message: 'Prompt deleted' });
  } catch (error) {
    console.error('Delete system prompt error:', error);
    res.status(500).json({ message: 'Failed to delete prompt' });
  }
});

// ============================================================================
// Global Controls
// ============================================================================

// @route   POST /api/system-prompts/settings/pause
// @desc    Pause system prompt posting globally
// @access  Admin
router.post('/settings/pause', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await SystemConfig.setValue(
      'systemPrompts.enabled',
      false,
      req.user.id,
      'System prompt posting paused by admin'
    );

    res.json({ message: 'System prompts paused', enabled: false });
  } catch (error) {
    console.error('Pause system prompts error:', error);
    res.status(500).json({ message: 'Failed to pause prompts' });
  }
});

// @route   POST /api/system-prompts/settings/resume
// @desc    Resume system prompt posting globally
// @access  Admin
router.post('/settings/resume', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await SystemConfig.setValue(
      'systemPrompts.enabled',
      true,
      req.user.id,
      'System prompt posting resumed by admin'
    );

    res.json({ message: 'System prompts resumed', enabled: true });
  } catch (error) {
    console.error('Resume system prompts error:', error);
    res.status(500).json({ message: 'Failed to resume prompts' });
  }
});

// @route   POST /api/system-prompts/settings/frequency
// @desc    Update posting frequency (in hours)
// @access  Admin
router.post('/settings/frequency', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { hours } = req.body;

    if (!hours || hours < 1 || hours > 168) { // 1 hour to 1 week
      return res.status(400).json({ message: 'Frequency must be between 1 and 168 hours' });
    }

    await SystemConfig.setValue(
      'systemPrompts.frequency',
      hours,
      req.user.id,
      `System prompt frequency set to ${hours} hours`
    );

    res.json({ message: 'Frequency updated', frequency: hours });
  } catch (error) {
    console.error('Update frequency error:', error);
    res.status(500).json({ message: 'Failed to update frequency' });
  }
});

// @route   POST /api/system-prompts/post-now
// @desc    Manually trigger a prompt post (for testing)
// @access  Admin
router.post('/post-now', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Temporarily enable if paused
    const wasEnabled = await SystemConfig.getValue('systemPrompts.enabled', true);
    if (!wasEnabled) {
      await SystemConfig.setValue('systemPrompts.enabled', true, req.user.id);
    }

    // Reset last posted time to allow immediate posting
    await SystemConfig.setValue('systemPrompts.lastPostedAt', null, req.user.id);

    const result = await postNextPrompt();

    // Restore previous enabled state
    if (!wasEnabled) {
      await SystemConfig.setValue('systemPrompts.enabled', false, req.user.id);
    }

    res.json({ message: 'Manual post triggered', ...result });
  } catch (error) {
    console.error('Manual post error:', error);
    res.status(500).json({ message: 'Failed to post prompt' });
  }
});

export default router;

