/**
 * Session Timeline Tracker
 * 
 * Records session-level events for error replay and debugging
 * 
 * Features:
 * - Circular buffer (last N events)
 * - Stored in memory (not permanent logs)
 * - Replayable in chronological order
 * - Attached to error reports
 * 
 * Tracked Events:
 * - Auth state changes
 * - Route changes
 * - Mutations (create/update/delete)
 * - API failures
 * - Token refresh events
 * - Service worker lifecycle events
 */

// Session timelines stored by session ID
const sessionTimelines = new Map();

// Maximum events per session (circular buffer)
const MAX_EVENTS_PER_SESSION = 100;

// Timeline retention time (30 minutes)
const TIMELINE_RETENTION_MS = 30 * 60 * 1000;

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Event type enum
 */
export const EventType = {
  AUTH_STATE_CHANGE: 'auth_state_change',
  ROUTE_CHANGE: 'route_change',
  MUTATION: 'mutation',
  API_FAILURE: 'api_failure',
  TOKEN_REFRESH: 'token_refresh',
  SERVICE_WORKER: 'service_worker',
  ERROR: 'error',
  SOCKET_EVENT: 'socket_event'
};

/**
 * Get or create timeline for session
 */
function getTimeline(sessionId) {
  if (!sessionTimelines.has(sessionId)) {
    sessionTimelines.set(sessionId, {
      sessionId,
      events: [],
      createdAt: Date.now(),
      lastUpdated: Date.now()
    });
  }
  
  return sessionTimelines.get(sessionId);
}

/**
 * Track an event in the session timeline
 */
export function trackEvent(sessionId, eventType, data = {}) {
  if (!sessionId) {
    console.warn('[Session Timeline] No session ID provided');
    return;
  }
  
  const timeline = getTimeline(sessionId);
  
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: eventType,
    timestamp: Date.now(),
    data
  };
  
  // Add to circular buffer
  timeline.events.push(event);
  
  // Keep only last N events
  if (timeline.events.length > MAX_EVENTS_PER_SESSION) {
    timeline.events.shift();
  }
  
  timeline.lastUpdated = Date.now();
  
  console.log(`[Session Timeline] ${sessionId}: ${eventType}`, data);
}

/**
 * Get timeline for a session
 */
export function getSessionTimeline(sessionId) {
  const timeline = sessionTimelines.get(sessionId);
  
  if (!timeline) {
    return {
      sessionId,
      events: [],
      createdAt: null,
      lastUpdated: null
    };
  }
  
  return timeline;
}

/**
 * Get timeline snapshot (for error reports)
 */
export function getTimelineSnapshot(sessionId) {
  const timeline = getSessionTimeline(sessionId);
  
  return {
    sessionId: timeline.sessionId,
    eventCount: timeline.events.length,
    events: timeline.events,
    createdAt: timeline.createdAt,
    lastUpdated: timeline.lastUpdated,
    capturedAt: Date.now()
  };
}

/**
 * Clear timeline for a session
 */
export function clearTimeline(sessionId) {
  sessionTimelines.delete(sessionId);
  console.log(`[Session Timeline] Cleared timeline for session ${sessionId}`);
}

/**
 * Get all active sessions
 */
export function getActiveSessions() {
  return Array.from(sessionTimelines.keys());
}

/**
 * Get summary of all timelines
 */
export function getTimelineSummary() {
  const sessions = Array.from(sessionTimelines.values());
  
  return {
    totalSessions: sessions.length,
    sessions: sessions.map(timeline => ({
      sessionId: timeline.sessionId,
      eventCount: timeline.events.length,
      createdAt: timeline.createdAt,
      lastUpdated: timeline.lastUpdated,
      age: Date.now() - timeline.createdAt
    }))
  };
}

/**
 * Cleanup old timelines
 */
function cleanupOldTimelines() {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [sessionId, timeline] of sessionTimelines.entries()) {
    if (now - timeline.lastUpdated > TIMELINE_RETENTION_MS) {
      sessionTimelines.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[Session Timeline] 🗑️ Cleaned up ${cleanedCount} old timelines`);
  }
}

// Start cleanup interval
setInterval(cleanupOldTimelines, CLEANUP_INTERVAL_MS);

console.log('[Session Timeline] 🚀 Session timeline tracker initialized');

