/**
 * Restriction Middleware — GOVERNANCE V1
 *
 * Enforces account governance status before write operations.
 * Applied to: POST /posts, POST /comments, POST /messages,
 *             POST /reactions, PATCH /profile, PATCH /avatar, PATCH /cover
 *
 * NOT applied to: login, read (GET) endpoints.
 *
 * Status handling:
 *   banned      → 403 "Account permanently removed."
 *   restricted  → 403 "You are temporarily restricted until <ISO date>."
 *   active (or restriction expired) → next()
 *
 * When a restriction expires mid-session the middleware auto-lifts it
 * (sets governanceStatus back to 'active', clears restrictedUntil).
 *
 * Requires req.user to be populated by the auth middleware upstream.
 */

import User from '../models/User.js';
import logger from '../utils/logger.js';

export default async function restrictionMiddleware(req, res, next) {
  try {
    // auth middleware must run first — skip silently if user is not available
    if (!req.user?._id) return next();

    // Fetch fresh governance fields (auth middleware may have a cached user)
    const user = await User.findById(req.user._id)
      .select('governanceStatus restrictedUntil role')
      .lean();

    if (!user) return next();

    // Admins and super_admins bypass governance restrictions
    if (user.role === 'admin' || user.role === 'super_admin') return next();

    const now = new Date();

    // ── Permanent ban ──────────────────────────────────────────────────────
    if (user.governanceStatus === 'banned') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_BANNED',
        message: 'Account permanently removed.'
      });
    }

    // ── Temporary restriction ──────────────────────────────────────────────
    if (user.governanceStatus === 'restricted') {
      if (user.restrictedUntil && now < new Date(user.restrictedUntil)) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_RESTRICTED',
          message: `You are temporarily restricted until ${new Date(user.restrictedUntil).toISOString()}.`,
          restrictedUntil: user.restrictedUntil
        });
      }

      // Restriction has expired — auto-lift without requiring a new request
      try {
        await User.findByIdAndUpdate(req.user._id, {
          governanceStatus: 'active',
          restrictedUntil: null
        });
        logger.info(`[GOVERNANCE] Restriction expired for user ${req.user._id} — auto-lifted`);
      } catch (liftErr) {
        logger.warn('[GOVERNANCE] Failed to auto-lift expired restriction:', liftErr);
      }
    }

    return next();
  } catch (err) {
    logger.error('[restrictionMiddleware] Unexpected error:', err);
    // Non-fatal: allow request to continue rather than blocking all writes on error
    return next();
  }
}
