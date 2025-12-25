/**
 * Dev Verification Routes
 * 
 * DEVELOPMENT ONLY endpoints for verifying database/API/frontend consistency.
 * These endpoints are ONLY available in development mode.
 * 
 * Usage: GET /api/dev/verify/:entity/:id
 * Returns:
 * - Raw DB document
 * - Serialized API response shape
 * - Expected frontend shape
 */

import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import logger from '../utils/logger.js';

// Model imports
import Post from '../models/Post.js';
import Draft from '../models/Draft.js';
import User from '../models/User.js';
import Comment from '../models/Comment.js';
import Notification from '../models/Notification.js';
import TempMedia from '../models/TempMedia.js';

// DEV-ONLY guard
const devOnlyGuard = (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ 
      message: 'Dev verification endpoints are only available in development mode' 
    });
  }
  next();
};

// Model registry for dynamic lookup
const models = {
  post: Post,
  draft: Draft,
  user: User,
  comment: Comment,
  notification: Notification,
  tempMedia: TempMedia
};

// Frontend shape transformers - how the API shapes data for frontend
const frontendTransformers = {
  post: (doc) => ({
    _id: doc._id,
    content: doc.content,
    author: doc.author?._id || doc.author,
    authorInfo: {
      username: doc.author?.username,
      displayName: doc.author?.displayName,
      profilePhoto: doc.author?.profilePhoto
    },
    media: doc.media || [],
    visibility: doc.visibility,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    likeCount: doc.hideMetrics ? null : (doc.likes?.length || 0),
    commentCount: doc.comments?.length || 0,
    hasLiked: false // Would be set dynamically based on current user
  }),

  draft: (doc) => ({
    _id: doc._id,
    draftType: doc.draftType,
    content: doc.content,
    media: doc.media || [],
    visibility: doc.visibility,
    updatedAt: doc.updatedAt
  }),

  tempMedia: (doc) => ({
    _id: doc._id,
    url: doc.url,
    type: doc.type,
    status: doc.status,
    ownerType: doc.ownerType,
    ownerId: doc.ownerId,
    createdAt: doc.createdAt
  })
};

/**
 * @route   GET /api/dev/verify/:entity/:id
 * @desc    Get DB doc, API response, and frontend shape for comparison
 * @access  Private (Dev only)
 */
router.get('/verify/:entity/:id', devOnlyGuard, auth, async (req, res) => {
  try {
    const { entity, id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const Model = models[entity.toLowerCase()];
    if (!Model) {
      return res.status(400).json({ 
        message: `Unknown entity type: ${entity}`,
        availableEntities: Object.keys(models)
      });
    }

    // Raw DB document
    const rawDoc = await Model.findById(id).lean();
    if (!rawDoc) {
      return res.status(404).json({ 
        message: `${entity} not found`,
        existsInDB: false
      });
    }

    // Populated document (as API would return)
    let populatedDoc = await Model.findById(id);
    if (entity === 'post') {
      await populatedDoc.populate('author', 'username displayName profilePhoto isVerified pronouns');
      await populatedDoc.populate('tags', 'slug label icon');
    }

    // Frontend shape
    const transformer = frontendTransformers[entity.toLowerCase()];
    const frontendShape = transformer ? transformer(populatedDoc) : null;

    res.json({
      entity,
      id,
      existsInDB: true,
      timestamp: new Date().toISOString(),
      comparison: {
        rawDocument: rawDoc,
        apiResponse: populatedDoc?.toObject() || null,
        frontendShape
      },
      _meta: {
        rawKeys: Object.keys(rawDoc),
        apiKeys: populatedDoc ? Object.keys(populatedDoc.toObject()) : [],
        frontendKeys: frontendShape ? Object.keys(frontendShape) : []
      }
    });
  } catch (error) {
    logger.error('Dev verify error:', error);
    res.status(500).json({ message: 'Verification failed', error: error.message });
  }
});

/**
 * @route   GET /api/dev/verify/snapshot/:entity
 * @desc    Get summary of all entities for comparison
 * @access  Private (Dev only)
 */
router.get('/verify/snapshot/:entity', devOnlyGuard, auth, async (req, res) => {
  try {
    const { entity } = req.params;
    const { limit = 10 } = req.query;

    const Model = models[entity.toLowerCase()];
    if (!Model) {
      return res.status(400).json({ message: `Unknown entity: ${entity}` });
    }

    const docs = await Model.find({})
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      entity,
      count: docs.length,
      totalInDB: await Model.countDocuments(),
      documents: docs.map(d => ({ _id: d._id, createdAt: d.createdAt }))
    });
  } catch (error) {
    logger.error('Dev snapshot error:', error);
    res.status(500).json({ message: 'Snapshot failed', error: error.message });
  }
});

export default router;

