/**
 * API Response Caching Middleware
 *
 * Provides selective caching for read-only API routes to improve performance.
 * Works alongside the security-first no-cache default.
 *
 * Usage:
 *   router.get('/feed', cache('short'), auth, handler);
 *   router.get('/badges', cache('long'), handler);
 */

/**
 * Cache duration presets (in seconds)
 */
const CACHE_DURATIONS = {
  // No cache - for sensitive/real-time data
  none: 0,

  // Short cache (30s) - for frequently changing data
  // Feed, search results, online status
  short: 30,

  // Medium cache (5 min) - for moderately stable data
  // User profiles, groups, collections
  medium: 300,

  // Long cache (1 hour) - for rarely changing data
  // Badge definitions, static content
  long: 3600,

  // Very long cache (1 day) - for essentially static data
  static: 86400
};

/**
 * Create cache middleware with specified duration
 *
 * @param {string|number} duration - Preset name ('short', 'medium', 'long') or seconds
 * @param {Object} options - Additional options
 * @param {boolean} options.private - If true, use private cache (user-specific data)
 * @param {boolean} options.staleWhileRevalidate - Allow stale content during revalidation
 * @param {number} options.staleTime - Time to serve stale content (default: same as maxAge)
 * @returns {Function} Express middleware
 */
export const cache = (duration = 'short', options = {}) => {
  const {
    private: isPrivate = true, // Default to private (user-specific data)
    staleWhileRevalidate = true,
    staleTime = null
  } = options;

  // Get duration in seconds
  const maxAge = typeof duration === 'number'
    ? duration
    : (CACHE_DURATIONS[duration] || CACHE_DURATIONS.short);

  // Skip caching if duration is 0
  if (maxAge === 0) {
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Build Cache-Control header
    const directives = [];

    // Private vs public caching
    directives.push(isPrivate ? 'private' : 'public');

    // Max age
    directives.push(`max-age=${maxAge}`);

    // Stale-while-revalidate for better UX
    if (staleWhileRevalidate) {
      const swr = staleTime || maxAge;
      directives.push(`stale-while-revalidate=${swr}`);
    }

    // Set headers (this overrides the global no-cache)
    res.setHeader('Cache-Control', directives.join(', '));

    // Remove conflicting headers set by hardening middleware
    res.removeHeader('Pragma');
    res.removeHeader('Expires');

    // Vary by Authorization header for user-specific caching
    if (isPrivate) {
      res.setHeader('Vary', 'Authorization');
    }

    next();
  };
};

/**
 * Preset middleware for common use cases
 */

// For feeds, search results, real-time lists
export const cacheShort = cache('short', { private: true });

// For user profiles, groups, collections
export const cacheMedium = cache('medium', { private: true });

// For badge catalogs, static definitions
export const cacheLong = cache('long', { private: false });

// For public static content
export const cacheStatic = cache('static', { private: false });

/**
 * Conditional cache based on query params
 * Useful for paginated endpoints where first page can be cached longer
 */
export const cacheConditional = (conditions) => {
  return (req, res, next) => {
    // Check if this is the first page (most commonly requested)
    const page = parseInt(req.query.page) || 1;
    const isFirstPage = page === 1;

    // Apply longer cache for first page
    if (isFirstPage && conditions.firstPage) {
      return cache(conditions.firstPage)(req, res, next);
    }

    // Apply shorter cache for subsequent pages
    if (conditions.otherPages) {
      return cache(conditions.otherPages)(req, res, next);
    }

    next();
  };
};

export default {
  cache,
  cacheShort,
  cacheMedium,
  cacheLong,
  cacheStatic,
  cacheConditional,
  CACHE_DURATIONS
};
