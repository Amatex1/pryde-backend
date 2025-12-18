import express from 'express';
const router = express.Router();
import Draft from '../models/Draft.js';
import auth from '../middleware/auth.js';

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

    console.log('💾 Saving draft:', {
      draftId,
      draftType,
      userId: req.userId,
      contentLength: content?.length || 0,
      hasMedia: media?.length > 0
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

      // Update fields
      if (content !== undefined) draft.content = content;
      if (title !== undefined) draft.title = title;
      if (body !== undefined) draft.body = body;
      if (media !== undefined) draft.media = media;
      if (coverImage !== undefined) draft.coverImage = coverImage;
      if (visibility !== undefined) draft.visibility = visibility;
      if (contentWarning !== undefined) draft.contentWarning = contentWarning;
      if (hideMetrics !== undefined) draft.hideMetrics = hideMetrics;
      if (mood !== undefined) draft.mood = mood;
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
      console.log('✅ Draft updated:', draft._id);
      return res.json(draft);
    }

    // Create new draft
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

    const draft = new Draft({
      user: req.userId,
      draftType: draftType || 'post',
      content: content || '',
      title: title || '',
      body: body || '',
      media: media || [],
      coverImage: coverImage || '',
      visibility: visibility || 'followers',
      contentWarning: contentWarning || '',
      hideMetrics: hideMetrics || false,
      mood: mood || null,
      tags: tags || [],
      poll: pollData
    });

    await draft.save();
    console.log('✅ New draft created:', draft._id);
    res.status(201).json(draft);
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/drafts/:id
// @desc    Delete a draft
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const draft = await Draft.findById(req.params.id);

    if (!draft) {
      return res.status(404).json({ message: 'Draft not found' });
    }

    if (draft.user.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await draft.deleteOne();
    res.json({ message: 'Draft deleted' });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

