/**
 * Daily Badge Sweep Job
 * 
 * 🔧 BADGE CHURN FIX
 * 
 * This scheduled job handles grace-period-aware badge revocation.
 * It runs daily and only revokes badges that have been unqualified
 * for longer than the grace period (default: 7 days).
 * 
 * This prevents badge flapping for `active_this_month` and similar
 * time-window-based badges.
 * 
 * Usage:
 *   - Automatically: Started by server.js on boot
 *   - Manually: node server/scripts/dailyBadgeSweep.js
 */

import cron from 'node-cron';
import mongoose from 'mongoose';
import { runDailyBadgeSweep } from '../services/autoBadgeService.js';

// Configuration
const SWEEP_HOUR = parseInt(process.env.BADGE_SWEEP_HOUR || '4', 10); // Default: 4 AM
const VALID_HOUR = (SWEEP_HOUR >= 0 && SWEEP_HOUR <= 23) ? SWEEP_HOUR : 4;

/**
 * Run the sweep (can be called directly or via cron)
 */
async function runSweep() {
  console.log('[DailyBadgeSweep] ⏰ Starting scheduled badge sweep...');
  console.log(`[DailyBadgeSweep] 📅 Time: ${new Date().toISOString()}`);
  
  try {
    const summary = await runDailyBadgeSweep();
    console.log('[DailyBadgeSweep] ✅ Complete:', JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error('[DailyBadgeSweep] ❌ Error:', error);
  }
}

/**
 * Start the scheduler
 */
export function startBadgeSweepScheduler() {
  console.log('[DailyBadgeSweep] 🕐 Starting scheduler...');
  console.log(`[DailyBadgeSweep] 📅 Sweep will run daily at ${VALID_HOUR.toString().padStart(2, '0')}:00 UTC`);
  
  // Schedule: specified hour, daily
  // Cron format: minute hour day month weekday
  cron.schedule(`0 ${VALID_HOUR} * * *`, async () => {
    console.log('\n[DailyBadgeSweep] ⏰ Scheduled job triggered');
    await runSweep();
  });
  
  return true;
}

// If run directly (not imported)
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;

if (isMainModule) {
  console.log('[DailyBadgeSweep] Running manual sweep...\n');
  
  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ No MongoDB URI found in environment');
    process.exit(1);
  }
  
  mongoose.connect(mongoUri)
    .then(async () => {
      console.log('✅ Connected to MongoDB');
      await runSweep();
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
    });
}

export default { startBadgeSweepScheduler, runSweep };

