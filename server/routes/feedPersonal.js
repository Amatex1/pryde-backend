/**
 * Personal Feed Route
 * 
 * NEW endpoint using fan-out-on-write FeedEntry system.
 * This runs in PARALLEL with existing feed endpoints.
 * 
 * DO NOT remove or modify existing feed routes.
 */

import express from 'express';
const router = express.Router();

import auth from '../middleware/auth.js';
import requireActiveUser from '../middleware/requireActiveUser.js';
import { getPersonalFeed } from '../controllers/feedController.js';

/**
 * GET /api/feed/personal
 * 
 * Get personalized feed using FeedEntry system.
 * 
 * Access: Authenticated users only
 */
router.get('/', auth, requireActiveUser, getPersonalFeed);

export default router;

