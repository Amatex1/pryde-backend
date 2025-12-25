import express from 'express';
const router = express.Router();
import Draft from '../models/Draft.js';
import auth from '../middleware/auth.js';
import { MutationTrace, verifyWrite } from '../utils/mutationTrace.js';
import logger from '../utils/logger.js';

// @route   GET /api/drafts
// @desc    Get all drafts for the current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { type } = req.query;
    const query = { user: req.userId };

    if (type) {
      query.draftType = type;
    }

    console.log('📥 Fetching drafts for user:', req.userId, 'type:', type);

    const drafts = await Draft.find(query)
      .sort({ updatedAt: -1 })
      .limit(50);

    console.log(`✅ Found ${drafts.length} drafts`);

    res.json({ drafts }); // Return as object with drafts property
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/drafts/:id
// @desc    Get a specific draft
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const draft = await Draft.findById(req.params.id);

    if (!draft) {
      return res.status(404).json({ message: 'Draft not found' });
    }

    // Check if user owns this draft
    if (draft.user.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(draft);
  } catch (error) {
    console.error('Get draft error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/drafts
// @desc    Create or update a draft (auto-save)
// @access  Private
router.post('/', auth, async (req, res) => {
  // Initialize mutation trace for end-to-end tracking
  const mutationId = req.headers['x-mutation-id'] || req.body?._mutationId;
  const isUpdate = !!req.body?.draftId;
  const mutation = new MutationTrace(mutationId, isUpdate ? 'UPDATE' : 'CREATE', 'draft', req.userId);
  mutation.addStep('REQUEST_RECEIVED', { method: 'POST', isUpdate });
  res.setHeader('X-Mutation-Id', mutation.mutationId);

  try {
    const {
      draftId,
      draftType,
      content,
      title,
      body,
      media,
      coverImage,
      visibility,
      contentWarning,
      hideMetrics,
      mood,
      tags,
      poll
    } = req.body;

    // DIAGNOSTIC: Detailed draft creation logging
    logger.debug('[DRAFT CREATE] Request received:', {
      draftId: draftId || 'NEW',
      draftType,
      userId: req.userId,
      contentLength: content?.length || 0,
      hasMedia: media?.length > 0,
      isUpdate: !!draftId,
      mutationId: mutation.mutationId
    });

    // If draftId provided, update existing draft
    if (draftId) {
      const draft = await Draft.findById(draftId);

      if (!draft) {
        return res.status(404).json({ message: 'Draft not found' });
      }

      if (draft.user.toString() !== req.userId.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      // Update fields - CRITICAL: Accept partial payloads without validation
      if (content !== undefined) draft.content = content;
      if (title !== undefined) draft.title = title;
      if (body !== undefined) draft.body = body;
      // Media: Accept as-is, no validation (schema allows optional fields)
      if (media !== undefined) draft.media = media;
      if (coverImage !== undefined) draft.coverImage = coverImage;
      if (visibility !== undefined) draft.visibility = visibility;
      if (contentWarning !== undefined) draft.contentWarning = contentWarning;
      if (hideMetrics !== undefined) draft.hideMetrics = hideMetrics;
      // CRITICAL: Normalize null/empty to undefined for mood (prevents enum validation error)
      if (mood !== undefined) {
        draft.mood = (mood === null || mood === '') ? undefined : mood;
      }
      if (tags !== undefined) draft.tags = tags;
      if (poll !== undefined) {
        // Transform poll options from array of strings to array of objects
        if (poll && poll.options) {
          const transformedOptions = poll.options
            .filter(opt => typeof opt === 'string' ? opt.trim() !== '' : opt.text && opt.text.trim() !== '')
            .map(opt => {
              if (typeof opt === 'object' && opt.text) {
                return { text: opt.text, votes: opt.votes || [] };
              }
              return { text: opt, votes: [] };
            });
          draft.poll = {
            question: poll.question || '',
            options: transformedOptions,
            endsAt: poll.endsAt || null,
            allowMultipleVotes: poll.allowMultipleVotes || false,
            showResultsBeforeVoting: poll.showResultsBeforeVoting || false
          };
        } else {
          draft.poll = poll;
        }
      }

      await draft.save();
      console.log('[DRAFT UPDATE] Draft updated successfully:', draft._id);
      return res.json(draft);
    }

    // Create new draft
    console.log('[DRAFT CREATE] Creating new draft for user:', req.userId);
    // Transform poll options if present
    let pollData = null;
    if (poll && poll.options) {
      const transformedOptions = poll.options
        .filter(opt => typeof opt === 'string' ? opt.trim() !== '' : opt.text && opt.text.trim() !== '')
        .map(opt => {
          if (typeof opt === 'object' && opt.text) {
            return { text: opt.text, votes: opt.votes || [] };
          }
          return { text: opt, votes: [] };
        });
      pollData = {
        question: poll.question || '',
        options: transformedOptions,
        endsAt: poll.endsAt || null,
        allowMultipleVotes: poll.allowMultipleVotes || false,
        showResultsBeforeVoting: poll.showResultsBeforeVoting || false
      };
    }

    // CRITICAL: Prepare draft data with proper null handling
    // Drafts accept partial payloads - no strict validation
    const draftData = {
      user: req.userId,
      draftType: draftType || 'post',
      content: content || '',
      title: title || '',
      body: body || '',
      // Media: Accept as-is, schema allows optional fields
      media: media || [],
      coverImage: coverImage || '',
      visibility: visibility || 'followers',
      contentWarning: contentWarning || '',
      hideMetrics: hideMetrics || false,
      tags: tags || [],
      poll: pollData
    };

    // Only set mood if it's a valid value (not null or undefined)
    if (mood && mood !== null) {
      draftData.mood = mood;
    }

    const draft = new Draft(draftData);
    mutation.addStep('DOCUMENT_CREATED', { draftId: draft._id.toString() });

    await draft.save();
    mutation.addStep('DOCUMENT_SAVED');

    // CRITICAL: Verify write succeeded
    await verifyWrite(Draft, draft._id, mutation, { user: req.userId });

    logger.debug('[DRAFT CREATE] New draft created successfully:', {
      id: draft._id,
      type: draft.draftType,
      userId: req.userId,
      mutationId: mutation.mutationId
    });

    mutation.success({ draftId: draft._id.toString() });
    res.status(201).json({ ...draft.toObject(), _mutationId: mutation.mutationId });
  } catch (error) {
    mutation.fail(error.message, 500);
    logger.error('[DRAFT CREATE] Save draft error:', error);
    logger.error('[DRAFT CREATE] This will cause a ghost draft if frontend sets ID optimistically');
    res.status(500).json({ message: 'Server error', error: error.message, _mutationId: mutation.mutationId });
  }
});

// @route   DELETE /api/drafts/:id
// @desc    Delete a draft
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  // Initialize mutation trace for end-to-end tracking
  const mutationId = req.headers['x-mutation-id'] || req.body?._mutationId;
  const mutation = new MutationTrace(mutationId, 'DELETE', 'draft', req.userId);
  mutation.addStep('REQUEST_RECEIVED', { method: 'DELETE', draftId: req.params.id });
  res.setHeader('X-Mutation-Id', mutation.mutationId);

  try {
    logger.debug('[DRAFT DELETE] Attempting to delete draft:', req.params.id, 'by user:', req.userId);

    const draft = await Draft.findById(req.params.id);

    if (!draft) {
      mutation.fail('Draft not found', 404);
      logger.warn('[DRAFT DELETE] Draft not found:', req.params.id);
      logger.warn('[DRAFT DELETE] This may be a ghost draft that was never persisted');
      return res.status(404).json({ message: 'Draft not found', _mutationId: mutation.mutationId });
    }

    mutation.addStep('DOCUMENT_FOUND', { ownerId: draft.user.toString() });

    if (draft.user.toString() !== req.userId.toString()) {
      mutation.fail('Not authorized', 403);
      logger.warn('[DRAFT DELETE] User not authorized:', req.userId, 'tried to delete draft owned by:', draft.user);
      return res.status(403).json({ message: 'Not authorized', _mutationId: mutation.mutationId });
    }

    mutation.addStep('AUTHORIZATION_PASSED');

    const draftId = draft._id;
    await draft.deleteOne();
    mutation.addStep('DOCUMENT_DELETED');

    // CRITICAL: Verify delete succeeded
    const verifyDeleted = await Draft.findById(draftId).lean();
    if (verifyDeleted) {
      mutation.addStep('VERIFY_DELETE_FAILED', { reason: 'Document still exists' });
      throw new Error(`Delete verification failed: Draft ${draftId} still exists after delete`);
    }
    mutation.addStep('VERIFY_DELETE_SUCCESS');

    logger.debug('[DRAFT DELETE] Draft deleted successfully:', req.params.id);
    mutation.success({ draftId: draftId.toString() });
    res.json({ message: 'Draft deleted', _mutationId: mutation.mutationId });
  } catch (error) {
    mutation.fail(error.message, 500);
    logger.error('[DRAFT DELETE] Delete draft error:', error);
    res.status(500).json({ message: 'Server error', _mutationId: mutation.mutationId });
  }
});

export default router;

