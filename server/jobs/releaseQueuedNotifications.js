/**
 * Release Queued Notifications Job
 * Runs every 5 minutes to unqueue notifications past their deliverAfter time.
 */

import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import logger from '../utils/logger.js';
import cron from 'node-cron';

const runReleaseJob = async () => {
  try {
    const now = new Date();
    
    const released = await Notification.updateMany(
      {
        queued: true,
        deliverAfter: { $lte: now }
      },
      {
        $set: {
          queued: false,
          updatedAt: now
        }
      }
    );

    if (released.modifiedCount > 0) {
      logger.info(`[QuietJob] Released ${released.modifiedCount} queued notifications`);
    }
  } catch (error) {
    logger.error('[QuietJob] Release job failed:', error);
  }
};

// Run every 5 minutes
cron.schedule('*/5 * * * *', runReleaseJob);

// Manual trigger for testing
export const triggerManualRelease = runReleaseJob;

logger.info('[QuietJob] Notification release job started (every 5min)');

