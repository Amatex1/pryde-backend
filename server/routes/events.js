import express from 'express';
const router = express.Router();
import Event from '../models/Event.js';
import auth from '../middleware/auth.js';
import { sanitizeFields } from '../middleware/sanitize.js';

// @route   GET /api/events
// @desc    Get all upcoming events
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, city, type, upcoming } = req.query;
    const query = {};

    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }

    // Filter by city
    if (city) {
      query['location.city'] = new RegExp(city, 'i');
    }

    // Filter by event type
    if (type && type !== 'all') {
      query.eventType = type;
    }

    // Only show upcoming events by default
    if (upcoming !== 'false') {
      query.startDate = { $gte: new Date() };
    }

    // Only show public events for non-authenticated users
    if (!req.userId) {
      query.isPrivate = false;
    }

    const events = await Event.find(query)
      .populate('creator', 'username displayName profilePhoto isVerified')
      .sort({ startDate: 1 })
      .limit(50);

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/events/:id
// @desc    Get single event
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('creator', 'username displayName profilePhoto isVerified')
      .populate('attendees.user', 'username displayName profilePhoto');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/events
// @desc    Create a new event
// @access  Private
router.post('/', auth, sanitizeFields(['title', 'description']), async (req, res) => {
  try {
    const {
      title,
      description,
      eventType,
      category,
      startDate,
      endDate,
      location,
      coverImage,
      maxAttendees,
      isPrivate,
      requiresApproval,
      tags,
      externalLink
    } = req.body;

    // Validation
    if (!title || !description || !eventType || !startDate || !endDate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (new Date(startDate) < new Date()) {
      return res.status(400).json({ message: 'Event start date must be in the future' });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ message: 'Event end date must be after start date' });
    }

    const event = new Event({
      title,
      description,
      creator: req.userId,
      eventType,
      category: category || 'social',
      startDate,
      endDate,
      location: location || {},
      coverImage: coverImage || '',
      maxAttendees: maxAttendees || null,
      isPrivate: isPrivate || false,
      requiresApproval: requiresApproval || false,
      tags: tags || [],
      externalLink: externalLink || ''
    });

    await event.save();
    await event.populate('creator', 'username displayName profilePhoto isVerified');

    res.status(201).json(event);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/events/:id
// @desc    Update an event
// @access  Private (creator only)
router.put('/:id', auth, sanitizeFields(['title', 'description']), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is the creator
    if (event.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this event' });
    }

    const {
      title,
      description,
      eventType,
      category,
      startDate,
      endDate,
      location,
      coverImage,
      maxAttendees,
      isPrivate,
      requiresApproval,
      tags,
      externalLink
    } = req.body;

    // Update fields
    if (title) event.title = title;
    if (description) event.description = description;
    if (eventType) event.eventType = eventType;
    if (category) event.category = category;
    if (startDate) event.startDate = startDate;
    if (endDate) event.endDate = endDate;
    if (location) event.location = location;
    if (coverImage !== undefined) event.coverImage = coverImage;
    if (maxAttendees !== undefined) event.maxAttendees = maxAttendees;
    if (isPrivate !== undefined) event.isPrivate = isPrivate;
    if (requiresApproval !== undefined) event.requiresApproval = requiresApproval;
    if (tags) event.tags = tags;
    if (externalLink !== undefined) event.externalLink = externalLink;

    await event.save();
    await event.populate('creator', 'username displayName profilePhoto isVerified');

    res.json(event);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete an event
// @access  Private (creator only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is the creator
    if (event.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this event' });
    }

    await Event.findByIdAndDelete(req.params.id);

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/events/:id/rsvp
// @desc    RSVP to an event
// @access  Private
router.post('/:id/rsvp', auth, async (req, res) => {
  try {
    const { status } = req.body; // 'going', 'interested', 'not-going'

    if (!['going', 'interested', 'not-going'].includes(status)) {
      return res.status(400).json({ message: 'Invalid RSVP status' });
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if event is full
    if (event.maxAttendees && status === 'going') {
      const goingCount = event.attendees.filter(a => a.status === 'going').length;
      if (goingCount >= event.maxAttendees) {
        return res.status(400).json({ message: 'Event is full' });
      }
    }

    // Remove existing RSVP if any
    event.attendees = event.attendees.filter(
      a => a.user.toString() !== req.userId.toString()
    );

    // Add new RSVP (unless status is 'not-going')
    if (status !== 'not-going') {
      event.attendees.push({
        user: req.userId,
        status,
        rsvpDate: new Date()
      });
    }

    await event.save();
    await event.populate('creator', 'username displayName profilePhoto isVerified');
    await event.populate('attendees.user', 'username displayName profilePhoto');

    res.json(event);
  } catch (error) {
    console.error('RSVP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

