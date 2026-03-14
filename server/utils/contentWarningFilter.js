/**
 * Content Warning Filter
 *
 * Transforms post arrays so that posts with a content warning have their
 * `content`, `images`, and `media` fields redacted when the client has NOT
 * explicitly acknowledged that warning.
 *
 * Usage in a route:
 *   import { applyContentWarnings } from '../utils/contentWarningFilter.js';
 *
 *   // Parse comma-separated list of acknowledged CW labels from the query
 *   const acknowledged = parseAcknowledged(req.query.cw_ack);
 *   const filtered = applyContentWarnings(posts, acknowledged);
 *
 * Frontend contract:
 *   - Include ?cw_ack=violence,drugs in the request to reveal those posts
 *   - Posts with contentWarning set and NOT acknowledged will have:
 *       content         → null
 *       images          → []
 *       media           → []
 *       contentBlurred  → true
 *       contentWarning  → (label still present so UI can show the warning)
 */

/**
 * Parse the cw_ack query parameter into a Set of lowercase label strings.
 * @param {string|string[]|undefined} cwAck - from req.query.cw_ack
 * @returns {Set<string>}
 */
export function parseAcknowledged(cwAck) {
  if (!cwAck) return new Set();
  const raw = Array.isArray(cwAck) ? cwAck.join(',') : String(cwAck);
  return new Set(
    raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  );
}

/**
 * Apply content warning filtering to a list of plain post objects.
 *
 * @param {Object[]} posts       - Array of lean post objects
 * @param {Set<string>} acknowledged - Labels the client has acknowledged
 * @returns {Object[]}           - Transformed posts
 */
export function applyContentWarnings(posts, acknowledged) {
  if (!posts?.length) return posts;

  return posts.map(post => {
    const cw = post.contentWarning?.trim().toLowerCase();
    if (!cw) return post; // No warning — pass through

    const isAcknowledged = acknowledged.has(cw) || acknowledged.has('all');
    if (isAcknowledged) return post;

    // Redact sensitive fields — keep metadata so UI can display the warning
    return {
      ...post,
      content: null,
      images: [],
      media: [],
      gifUrl: null,
      contentBlurred: true
      // contentWarning is intentionally preserved so the UI can show why it's blurred
    };
  });
}

/**
 * Apply content warning filtering to a single post object.
 */
export function applyContentWarning(post, acknowledged) {
  if (!post) return post;
  return applyContentWarnings([post], acknowledged)[0];
}
