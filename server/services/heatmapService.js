/**
 * Heatmap Service
 *
 * Ranks an array of posts by their heat score (descending).
 * Each returned post gains a `heatScore` property.
 */

import { calculateHeatScore } from '../utils/heatScore.js';

/**
 * Rank posts by heat score, highest first.
 *
 * @param {object[]} posts  - Array of Mongoose lean objects
 * @returns {object[]}      - Same posts with `heatScore` added, sorted desc
 */
export function rankPostsByHeat(posts) {
  return posts
    .map((post) => ({
      ...post,
      heatScore: calculateHeatScore(post),
    }))
    .sort((a, b) => b.heatScore - a.heatScore);
}
