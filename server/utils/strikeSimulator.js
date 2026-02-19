/**
 * Strike Simulator — GOVERNANCE V1 SIMULATION MODE
 *
 * Predicts what the strike escalation engine would do for a given user and
 * violation — WITHOUT modifying any user fields or persisting anything.
 *
 * SAFETY CONTRACT (must never be violated):
 *   ✗ Does NOT write to user.postStrikes / commentStrikes / dmStrikes / globalStrikes
 *   ✗ Does NOT set user.restrictedUntil
 *   ✗ Does NOT change user.governanceStatus
 *   ✗ Does NOT save the user document
 *   ✓ Returns a plain object describing what WOULD happen
 *
 * Escalation ladder (mirrors strikeManager.js):
 *   Category strike 2  → WOULD_48_HOUR_RESTRICTION
 *   Category strike 3  → WOULD_30_DAY_SHADOW
 *   Global strike >= 4 → WOULD_PERMANENT_BAN
 */

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Simulate the effect of one strike on a user.
 *
 * @param {object} user          - User document (or plain object with governance fields).
 *                                 Read-only — nothing is written.
 * @param {string} category      - 'post' | 'comment' | 'dm'
 * @param {string} violationType - The resolved moderation action (informational only)
 * @returns {object} Simulation result — safe to store on ModerationEvent
 */
function simulateStrike(user, category, violationType) {
  const now = new Date();

  // --- Start from the user's current persisted counters (read-only snapshot) ---
  let simulated = {
    postStrikes:    user.postStrikes    || 0,
    commentStrikes: user.commentStrikes || 0,
    dmStrikes:      user.dmStrikes      || 0,
    globalStrikes:  user.globalStrikes  || 0,
    simulatedAction:        'NONE',
    simulatedCategoryLevel: 0,
    simulatedGlobalLevel:   0
  };

  // --- Rolling 30-day window reset (simulation only, mirrors decay logic) ---
  if (user.lastViolationAt && (now - new Date(user.lastViolationAt)) > WINDOW_MS) {
    simulated.postStrikes    = 0;
    simulated.commentStrikes = 0;
    simulated.dmStrikes      = 0;
    simulated.globalStrikes  = 0;
  }

  // --- Increment the relevant category (in-simulation only) ---
  if (category === 'post')    simulated.postStrikes++;
  if (category === 'comment') simulated.commentStrikes++;
  if (category === 'dm')      simulated.dmStrikes++;

  simulated.globalStrikes++;

  // --- Resolve category-specific level ---
  const categoryLevel =
    category === 'post'    ? simulated.postStrikes :
    category === 'comment' ? simulated.commentStrikes :
                             simulated.dmStrikes;

  simulated.simulatedCategoryLevel = categoryLevel;
  simulated.simulatedGlobalLevel   = simulated.globalStrikes;

  // --- Escalation logic (mirrors strikeManager.applyStrike) ---
  if (simulated.globalStrikes >= 4) {
    // Global threshold reached — takes priority over category level
    simulated.simulatedAction = 'WOULD_PERMANENT_BAN';
  } else if (categoryLevel >= 3) {
    simulated.simulatedAction = 'WOULD_30_DAY_SHADOW';
  } else if (categoryLevel === 2) {
    simulated.simulatedAction = 'WOULD_48_HOUR_RESTRICTION';
  }
  // categoryLevel === 1 → simulatedAction stays 'NONE' (first strike, no restriction)

  return simulated;
}

export default simulateStrike;
