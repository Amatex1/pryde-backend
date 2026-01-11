/**
 * Validated Socket Emit Helper
 * 
 * Ensures all socket emissions use canonical event names.
 * Validation is DEV-ONLY - production behavior unchanged.
 * 
 * @see /docs/REALTIME_EVENT_CONTRACT.md
 */

const isDev = process.env.NODE_ENV !== 'production';

// Canonical allowed events (must match REALTIME_EVENT_CONTRACT.md)
const ALLOWED_EVENTS = [
  // Messages
  'message:new',
  'message:sent',
  'message:read',
  'message:deleted',
  
  // Notifications
  'notification:new',
  'notification:read',
  'notification:read_all',
  'notification:deleted',
  
  // Global Chat
  'global_message:new',
  'global_chat:online_count',
  'global_chat:user_typing',
  'global_chat:online_users_list',
  
  // Presence
  'presence:update',
  'user_typing',
  'online_users',
  
  // Friend requests (legacy - to be migrated)
  'friend_request_received',
  'friend_request_accepted',
  
  // Errors
  'error'
];

// Required payload keys per event (for validation)
const REQUIRED_KEYS = {
  'message:new': ['_id', 'sender', 'content'],
  'message:sent': ['_id', 'sender', 'content'],
  'message:read': ['messageIds', 'readBy'],
  'message:deleted': ['_id'],
  'notification:new': ['_id', 'type'],
  'notification:read': ['_id'],
  'notification:read_all': ['userId'],
  'notification:deleted': ['_id'],
  'global_message:new': ['_id', 'text', 'user'],
  'presence:update': ['userId', 'online'],
  'error': ['message']
};

/**
 * Validate and emit a socket event
 * @param {Object} emitter - Socket.IO io, socket, or socket.to() result
 * @param {string} eventName - Event name to emit
 * @param {Object} payload - Event payload
 * @returns {boolean} - Whether emit was called
 */
function emitValidated(emitter, eventName, payload) {
  if (isDev) {
    // Validate event name
    if (!ALLOWED_EVENTS.includes(eventName)) {
      console.warn(
        `⚠️ [Socket] Invalid event name: "${eventName}"`,
        '\n   Allowed events:', ALLOWED_EVENTS.join(', '),
        '\n   Add to REALTIME_EVENT_CONTRACT.md if this is a new event.'
      );
    }
    
    // Validate payload keys
    const requiredKeys = REQUIRED_KEYS[eventName];
    if (requiredKeys && payload) {
      const missingKeys = requiredKeys.filter(key => !(key in payload));
      if (missingKeys.length > 0) {
        console.warn(
          `⚠️ [Socket] Missing required keys for "${eventName}":`,
          missingKeys.join(', '),
          '\n   Payload:', JSON.stringify(payload, null, 2).substring(0, 200)
        );
      }
    }
  }
  
  // Always emit (validation is advisory only)
  emitter.emit(eventName, payload);
  return true;
}

/**
 * Create a validated emitter for socket.to() chains
 * @param {Object} io - Socket.IO server instance
 * @param {string} room - Room name to emit to
 * @returns {Object} - Object with emit method
 */
function toRoom(io, room) {
  const roomEmitter = io.to(room);
  return {
    emit: (eventName, payload) => emitValidated(roomEmitter, eventName, payload)
  };
}

/**
 * Create a validated emitter for direct socket
 * @param {Object} socket - Socket.IO socket instance
 * @returns {Object} - Object with emit and toRoom methods
 */
function wrapSocket(socket) {
  return {
    emit: (eventName, payload) => emitValidated(socket, eventName, payload),
    to: (room) => ({
      emit: (eventName, payload) => emitValidated(socket.to(room), eventName, payload)
    })
  };
}

/**
 * Create a validated emitter for io instance
 * @param {Object} io - Socket.IO server instance
 * @returns {Object} - Object with emit and toRoom methods
 */
function wrapIO(io) {
  return {
    emit: (eventName, payload) => emitValidated(io, eventName, payload),
    to: (room) => ({
      emit: (eventName, payload) => emitValidated(io.to(room), eventName, payload)
    })
  };
}

module.exports = {
  emitValidated,
  toRoom,
  wrapSocket,
  wrapIO,
  ALLOWED_EVENTS,
  REQUIRED_KEYS
};

