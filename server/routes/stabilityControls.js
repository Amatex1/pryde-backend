/**
 * User-Visible Stability Controls
 * 
 * In Settings → Stability:
 * - Stability Score indicator
 * - Safe Mode toggle
 * - Diagnostics opt-in checkbox
 * - "Report bug with snapshot" button
 * 
 * Shown only when relevant.
 */

import express from 'express';
import auth from '../middleware/auth.js';
import {
  calculateStabilityScore,
  getStabilityLevel,
  getStabilityMessage,
  getUserStabilityReport
} from '../utils/stabilityScore.js';
import { getSafeModeStatus, enableSafeMode, disableSafeMode } from '../utils/autoSafeMode.js';
import { captureSessionSnapshot } from '../utils/sessionDiff.js';
import { reportBugWithSnapshot } from '../utils/bugClustering.js';
import { getSafeModeBanner, shouldShowSafeModeBanner, dismissSafeModeBanner } from '../utils/safeModeBanner.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// User preferences for diagnostics
const diagnosticsPreferences = new Map();

/**
 * @route   GET /api/stability/status
 * @desc    Get user's stability status
 * @access  Private
 */
router.get('/status', (req, res) => {
  try {
    const userId = req.userId.toString();
    const sessionId = req.headers['x-session-id'] || 'unknown';

    const stabilityScore = getUserStabilityReport(userId);
    const safeModeStatus = getSafeModeStatus(sessionId);
    const diagnosticsOptIn = diagnosticsPreferences.get(userId) || false;

    res.json({
      stabilityScore,
      safeModeEnabled: safeModeStatus.enabled,
      diagnosticsOptIn,
      showStabilityControls: stabilityScore.score < 90 || safeModeStatus.enabled
    });
  } catch (error) {
    console.error('Get stability status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/stability/safe-mode/toggle
 * @desc    Toggle Safe Mode
 * @access  Private
 */
router.post('/safe-mode/toggle', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || 'unknown';
    const { enabled } = req.body;
    
    if (enabled) {
      enableSafeMode(sessionId, 'user_manual');
    } else {
      disableSafeMode(sessionId);
    }
    
    res.json({
      success: true,
      safeModeEnabled: enabled
    });
  } catch (error) {
    console.error('Toggle Safe Mode error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/stability/diagnostics/opt-in
 * @desc    Opt in/out of diagnostics
 * @access  Private
 */
router.post('/diagnostics/opt-in', (req, res) => {
  try {
    const userId = req.userId.toString();
    const { optIn } = req.body;
    
    diagnosticsPreferences.set(userId, optIn);
    
    res.json({
      success: true,
      diagnosticsOptIn: optIn
    });
  } catch (error) {
    console.error('Diagnostics opt-in error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/stability/report-bug
 * @desc    Report bug with session snapshot
 * @access  Private
 */
router.post('/report-bug', async (req, res) => {
  try {
    const userId = req.userId.toString();
    const sessionId = req.headers['x-session-id'] || 'unknown';
    const { description, category } = req.body;
    
    // Check if user has opted in to diagnostics
    const diagnosticsOptIn = diagnosticsPreferences.get(userId) || false;
    if (!diagnosticsOptIn) {
      return res.status(403).json({
        message: 'Please opt in to diagnostics to report bugs with snapshots'
      });
    }
    
    // Capture session snapshot
    const snapshot = captureSessionSnapshot(sessionId);
    
    // Report bug with snapshot
    const report = await reportBugWithSnapshot({
      userId,
      sessionId,
      description,
      category,
      snapshot,
      timestamp: Date.now()
    });
    
    res.json({
      success: true,
      reportId: report.id,
      message: 'Bug report submitted successfully'
    });
  } catch (error) {
    console.error('Report bug error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/stability/recommendations
 * @desc    Get stability recommendations
 * @access  Private
 */
router.get('/recommendations', (req, res) => {
  try {
    const userId = req.userId.toString();
    const stabilityScore = getUserStabilityReport(userId);

    const recommendations = [];

    if (stabilityScore.score < 70) {
      recommendations.push({
        type: 'enable_safe_mode',
        title: 'Enable Safe Mode',
        description: 'Safe Mode disables advanced features to improve stability',
        priority: 'high'
      });
    }

    if (stabilityScore.metrics.errors > 5) {
      recommendations.push({
        type: 'clear_cache',
        title: 'Clear Cache',
        description: 'Clearing your cache may resolve persistent errors',
        priority: 'medium'
      });
    }
    
    if (stabilityScore.metrics.offlineRecoveryRate < 0.8) {
      recommendations.push({
        type: 'check_connection',
        title: 'Check Connection',
        description: 'Your connection appears unstable. Try switching networks.',
        priority: 'medium'
      });
    }
    
    res.json({
      recommendations,
      total: recommendations.length
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/stability/banner
 * @desc    Get Safe Mode banner configuration
 * @access  Private
 */
router.get('/banner', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || 'unknown';

    const banner = getSafeModeBanner(sessionId);

    res.json({
      banner,
      shouldShow: shouldShowSafeModeBanner(sessionId)
    });
  } catch (error) {
    console.error('Get Safe Mode banner error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/stability/banner/dismiss
 * @desc    Dismiss Safe Mode banner
 * @access  Private
 */
router.post('/banner/dismiss', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || 'unknown';

    const dismissed = dismissSafeModeBanner(sessionId);

    if (!dismissed) {
      return res.status(403).json({
        message: 'Cannot dismiss auto-activated Safe Mode banner'
      });
    }

    res.json({
      success: true,
      dismissed: true
    });
  } catch (error) {
    console.error('Dismiss Safe Mode banner error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;

