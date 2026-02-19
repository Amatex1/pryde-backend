/**
 * Governance Config — Strike Simulation Mode
 *
 * SIMULATE_STRIKES: When true, each moderation event runs through the
 *   strike escalation engine and records what *would* happen — without
 *   touching the user model, applying restrictions, or persisting counters.
 *
 * ENFORCE_STRIKES: Reserved for when the governance system goes live.
 *   Must remain false during simulation-only phase.
 */
const SIMULATE_STRIKES = true;
const ENFORCE_STRIKES = false;

export { SIMULATE_STRIKES, ENFORCE_STRIKES };
export default { SIMULATE_STRIKES, ENFORCE_STRIKES };
