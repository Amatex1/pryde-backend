import express from 'express';
const router = express.Router();
import auth from '../middleware/auth.js';
import User from '../models/User.js';

/**
 * Quiet Mode Settings API
 * Controls notification suppression during configured hours
 */

// Get current quiet mode settings
router.get('/quiet-mode', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('privacySettings');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const quietSettings = {
      enabled: user.privacySettings.quietModeEnabled || false,
      hoursEnabled: user.privacySettings.quietHoursEnabled || false,
      start: user.privacySettings.quietHoursStart || '22:00',
      end: user.privacySettings.quietHoursEnd || '08:00',
      allowCritical: user.privacySettings.allowCriticalDuringQuiet || true
    };

    res.json(quietSettings);
  } catch (error) {
    console.error('Quiet mode get error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update quiet mode settings
router.put('/quiet-mode', auth, async (req, res) => {
  try {
    const { enabled, hoursEnabled, start, end, allowCritical } = req.body;

    // Validation
    if (enabled === true && hoursEnabled !== false) {
      if (!start || !end || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
        return res.status(400).json({ message: 'Invalid time format. Use HH:MM (24-hour)' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          'privacySettings.quietModeEnabled': enabled !== undefined ? enabled : undefined,
          'privacySettings.quietHoursEnabled': hoursEnabled !== undefined ? hoursEnabled : undefined,
          'privacySettings.quietHoursStart': start,
          'privacySettings.quietHoursEnd': end,
          'privacySettings.allowCriticalDuringQuiet': allowCritical !== undefined ? allowCritical : undefined
        }
      },
      { new: true }
    ).select('privacySettings');

    const quietSettings = {
      enabled: user.privacySettings.quietModeEnabled,
      hoursEnabled: user.privacySettings.quietHoursEnabled,
      start: user.privacySettings.quietHoursStart,
      end: user.privacySettings.quietHoursEnd,
      allowCritical: user.privacySettings.allowCriticalDuringQuiet
    };

    res.json({ success: true, settings: quietSettings });
  } catch (error) {
    console.error('Quiet mode update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

