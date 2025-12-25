/**
 * Mutation Queue Tracker
 * 
 * Tracks all mutations (create/update/delete) for debugging and observability
 * 
 * Features:
 * - Track mutation lifecycle (pending → confirmed → failed)
 * - Detect stuck mutations
 * - Detect retry storms
 * - Admin/dev visualization
 */

import { v4 as uuidv4 } from 'uuid';

// In-memory mutation queue (can be moved to Redis for production)
const mutationQueue = new Map();

// Mutation retention time (5 minutes)
const MUTATION_RETENTION_MS = 5 * 60 * 1000;

// Cleanup interval (1 minute)
const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * Mutation status enum
 */
export const MutationStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back'
};

/**
 * Mutation type enum
 */
export const MutationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete'
};

/**
 * Track a new mutation
 */
export function trackMutation(type, entity, data = {}) {
  const mutationId = uuidv4();
  
  const mutation = {
    id: mutationId,
    type,
    entity,
    status: MutationStatus.PENDING,
    data,
    retryCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    confirmedAt: null,
    failedAt: null
  };
  
  mutationQueue.set(mutationId, mutation);
  
  console.log(`[Mutation Tracker] 📝 Tracked ${type} mutation for ${entity}: ${mutationId}`);
  
  return mutationId;
}

/**
 * Confirm a mutation (success)
 */
export function confirmMutation(mutationId) {
  const mutation = mutationQueue.get(mutationId);
  
  if (!mutation) {
    console.warn(`[Mutation Tracker] ⚠️ Mutation not found: ${mutationId}`);
    return false;
  }
  
  mutation.status = MutationStatus.CONFIRMED;
  mutation.confirmedAt = Date.now();
  mutation.updatedAt = Date.now();
  
  mutationQueue.set(mutationId, mutation);
  
  console.log(`[Mutation Tracker] ✅ Confirmed mutation: ${mutationId}`);
  
  return true;
}

/**
 * Fail a mutation
 */
export function failMutation(mutationId, error = null) {
  const mutation = mutationQueue.get(mutationId);
  
  if (!mutation) {
    console.warn(`[Mutation Tracker] ⚠️ Mutation not found: ${mutationId}`);
    return false;
  }
  
  mutation.status = MutationStatus.FAILED;
  mutation.failedAt = Date.now();
  mutation.updatedAt = Date.now();
  mutation.error = error?.message || error;
  
  mutationQueue.set(mutationId, mutation);
  
  console.log(`[Mutation Tracker] ❌ Failed mutation: ${mutationId}`);
  
  return true;
}

/**
 * Retry a mutation
 */
export function retryMutation(mutationId) {
  const mutation = mutationQueue.get(mutationId);
  
  if (!mutation) {
    console.warn(`[Mutation Tracker] ⚠️ Mutation not found: ${mutationId}`);
    return false;
  }
  
  mutation.retryCount++;
  mutation.status = MutationStatus.PENDING;
  mutation.updatedAt = Date.now();
  
  mutationQueue.set(mutationId, mutation);
  
  console.log(`[Mutation Tracker] 🔄 Retrying mutation (attempt ${mutation.retryCount}): ${mutationId}`);
  
  return true;
}

/**
 * Rollback a mutation
 */
export function rollbackMutation(mutationId) {
  const mutation = mutationQueue.get(mutationId);
  
  if (!mutation) {
    console.warn(`[Mutation Tracker] ⚠️ Mutation not found: ${mutationId}`);
    return false;
  }
  
  mutation.status = MutationStatus.ROLLED_BACK;
  mutation.updatedAt = Date.now();
  
  mutationQueue.set(mutationId, mutation);
  
  console.log(`[Mutation Tracker] ↩️ Rolled back mutation: ${mutationId}`);
  
  return true;
}

/**
 * Get all mutations (for admin/dev visualization)
 */
export function getAllMutations() {
  return Array.from(mutationQueue.values());
}

/**
 * Get mutations by status
 */
export function getMutationsByStatus(status) {
  return Array.from(mutationQueue.values()).filter(m => m.status === status);
}

/**
 * Get stuck mutations (pending for > 30 seconds)
 */
export function getStuckMutations() {
  const now = Date.now();
  const STUCK_THRESHOLD_MS = 30 * 1000;
  
  return Array.from(mutationQueue.values()).filter(m => {
    return m.status === MutationStatus.PENDING && (now - m.createdAt) > STUCK_THRESHOLD_MS;
  });
}

/**
 * Get mutations with high retry count (> 3)
 */
export function getHighRetryMutations() {
  return Array.from(mutationQueue.values()).filter(m => m.retryCount > 3);
}

/**
 * Cleanup old mutations
 */
function cleanupOldMutations() {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [id, mutation] of mutationQueue.entries()) {
    // Only cleanup confirmed or failed mutations
    if (mutation.status === MutationStatus.CONFIRMED || mutation.status === MutationStatus.FAILED) {
      if (now - mutation.updatedAt > MUTATION_RETENTION_MS) {
        mutationQueue.delete(id);
        cleanedCount++;
      }
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[Mutation Tracker] 🗑️ Cleaned up ${cleanedCount} old mutations`);
  }
}

// Start cleanup interval
setInterval(cleanupOldMutations, CLEANUP_INTERVAL_MS);

console.log('[Mutation Tracker] 🚀 Mutation tracker initialized');

