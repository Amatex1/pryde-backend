/**
 * Moderation Analytics Service
 * 
 * Provides analytics and reporting for moderation activities.
 * Tracks moderation events, user behavior, and system performance.
 */

import User from '../models/User.js';
import ModerationEvent from '../models/ModerationEvent.js';
import logger from '../utils/logger.js';

/**
 * Get moderation dashboard analytics
 */
export const getModerationAnalytics = async (options = {}) => {
  const { days = 7, startDate, endDate } = options;
  
  const dateFilter = startDate && endDate 
    ? { createdAt: { $gte: startDate, $lte: endDate } }
    : { createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } };

  try {
    // Get event counts by type
    const eventCounts = await ModerationEvent.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$action', count: { $sum: 1 } } }
    ]);

    // Get events by category
    const categoryCounts = await ModerationEvent.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // Get top flagged users
    const topFlaggedUsers = await ModerationEvent.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$_id',
          username: '$user.username',
          displayName: '$user.displayName',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Get moderation response times (if events have timestamps)
    const avgResponseTime = await getAverageResponseTime(dateFilter);

    // Get resolution rate
    const resolutionStats = await getResolutionStats(dateFilter);

    // Get user trust score distribution
    const trustScoreDistribution = await getTrustScoreDistribution();

    return {
      summary: {
        totalEvents: eventCounts.reduce((sum, e) => sum + e.count, 0),
        eventsByType: Object.fromEntries(eventCounts.map(e => [e._id, e.count])),
        eventsByCategory: Object.fromEntries(categoryCounts.map(c => [c._id, c.count])),
        period: { days, startDate: dateFilter.createdAt.$gte, endDate: new Date() }
      },
      topFlaggedUsers,
      metrics: {
        averageResponseTimeMs: avgResponseTime,
        ...resolutionStats,
        trustScoreDistribution
      }
    };
  } catch (error) {
    logger.error('[ModerationAnalytics] Error getting analytics:', error.message);
    throw error;
  }
};

/**
 * Get average response time for moderation events
 */
const getAverageResponseTime = async (dateFilter) => {
  try {
    const events = await ModerationEvent.find(dateFilter)
      .select('createdAt handledAt')
      .lean();
    
    if (events.length === 0) return 0;

    const totalTime = events.reduce((sum, event) => {
      if (event.handledAt && event.createdAt) {
        return sum + (new Date(event.handledAt) - new Date(event.createdAt));
      }
      return sum;
    }, 0);

    return Math.round(totalTime / events.length);
  } catch (error) {
    logger.warn('[ModerationAnalytics] Could not calculate response time:', error.message);
    return 0;
  }
};

/**
 * Get resolution statistics
 */
const getResolutionStats = async (dateFilter) => {
  try {
    const total = await ModerationEvent.countDocuments(dateFilter);
    const resolved = await ModerationEvent.countDocuments({ 
      ...dateFilter, 
      status: { $in: ['resolved', 'overridden', 'dismissed'] }
    });
    const pending = await ModerationEvent.countDocuments({ 
      ...dateFilter, 
      status: 'pending'
    });

    return {
      totalEvents: total,
      resolvedEvents: resolved,
      pendingEvents: pending,
      resolutionRate: total > 0 ? ((resolved / total) * 100).toFixed(2) + '%' : '0%'
    };
  } catch (error) {
    logger.warn('[ModerationAnalytics] Could not get resolution stats:', error.message);
    return { totalEvents: 0, resolvedEvents: 0, pendingEvents: 0, resolutionRate: '0%' };
  }
};

/**
 * Get trust score distribution across all users
 */
const getTrustScoreDistribution = async () => {
  try {
    const distribution = await User.aggregate([
      { $match: { 'moderation.behaviorScore': { $exists: true } } },
      {
        $bucket: {
          groupBy: '$moderation.behaviorScore',
          boundaries: [0, 20, 40, 60, 80, 100],
          default: 'Other',
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    return distribution.map(b => ({
      range: b._id === 'Other' ? 'Other' : `${b._id}-${b._id + 20}`,
      count: b.count
    }));
  } catch (error) {
    logger.warn('[ModerationAnalytics] Could not get trust score distribution:', error.message);
    return [];
  }
};

/**
 * Get appeals statistics
 */
export const getAppealsAnalytics = async (options = {}) => {
  const { days = 30 } = options;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const appeals = await ModerationEvent.find({
      createdAt: { $gte: startDate },
      appealStatus: { $exists: true }
    });

    const totalAppeals = appeals.length;
    const upheldAppeals = appeals.filter(e => e.appealStatus === 'upheld').length;
    const overturnedAppeals = appeals.filter(e => e.appealStatus === 'overturned').length;
    const pendingAppeals = appeals.filter(e => e.appealStatus === 'pending').length;

    return {
      totalAppeals,
      upheldAppeals,
      overturnedAppeals,
      pendingAppeals,
      overturnRate: totalAppeals > 0 ? ((overturnedAppeals / totalAppeals) * 100).toFixed(2) + '%' : '0%',
      period: { days, startDate }
    };
  } catch (error) {
    logger.error('[ModerationAnalytics] Error getting appeals analytics:', error.message);
    return { totalAppeals: 0, upheldAppeals: 0, overturnedAppeals: 0, pendingAppeals: 0, overturnRate: '0%' };
  }
};

/**
 * Record an appeal for a moderation event
 */
export const recordAppeal = async (eventId, appealReason, userId) => {
  try {
    const event = await ModerationEvent.findById(eventId);
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    event.appealStatus = 'pending';
    event.appealReason = appealReason;
    event.appealedBy = userId;
    event.appealedAt = new Date();

    await event.save();

    logger.info(`[ModerationAnalytics] Appeal recorded for event ${eventId}`);
    return { success: true, event };
  } catch (error) {
    logger.error('[ModerationAnalytics] Error recording appeal:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Resolve an appeal
 */
export const resolveAppeal = async (eventId, resolution, adminId, resolutionReason) => {
  try {
    const event = await ModerationEvent.findById(eventId);
    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    event.appealStatus = resolution; // 'upheld' or 'overturned'
    event.appealResolution = resolutionReason;
    event.appealResolvedBy = adminId;
    event.appealResolvedAt = new Date();

    await event.save();

    // If overturned, restore user's content/permissions
    if (resolution === 'overturned') {
      await handleOverturnedAppeal(event);
    }

    logger.info(`[ModerationAnalytics] Appeal resolved for event ${eventId}: ${resolution}`);
    return { success: true, event };
  } catch (error) {
    logger.error('[ModerationAnalytics] Error resolving appeal:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Handle overturned appeals - restore user content/permissions
 */
const handleOverturnedAppeal = async (event) => {
  try {
    const userId = event.userId;

    switch (event.action) {
      case 'MUTE':
        await User.findByIdAndUpdate(userId, {
          $set: {
            'moderation.isMuted': false,
            'moderation.muteExpires': null,
            'moderation.muteReason': null
          }
        });
        break;
        
      case 'BLOCK':
        // Content was blocked - no automatic restoration needed
        // Admin would manually restore if appropriate
        break;
        
      case 'DAMPEN':
        // Reduce the visibility/dampening
        await User.findByIdAndUpdate(userId, {
          $inc: { 'moderation.behaviorScore': 10 }
        });
        break;
        
      default:
        logger.warn(`[ModerationAnalytics] No automatic restoration for action: ${event.action}`);
    }

    logger.info(`[ModerationAnalytics] Overturned appeal handled for user ${userId}`);
  } catch (error) {
    logger.error('[ModerationAnalytics] Error handling overturned appeal:', error.message);
  }
};

export default {
  getModerationAnalytics,
  getAppealsAnalytics,
  recordAppeal,
  resolveAppeal
};
