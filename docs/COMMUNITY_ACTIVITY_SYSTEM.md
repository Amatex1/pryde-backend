# Community Activity Layer - Implementation Report

## Executive Summary

This document outlines the implementation of the Community Activity Layer for Pryde Social. All systems are **additive** - no existing functionality is broken.

---

## Phase 1: ActivityEvent Model ✅ COMPLETED

**File:** `server/models/ActivityEvent.js`

**Schema Fields:**
- `type`: enum (new_member, first_post, active_discussion, trending_post, community_prompt, badge_earned)
- `userId`: Optional reference to User
- `postId`: Optional reference to Post
- `meta`: Mixed object for additional data
- `badgeId`: For badge_earned events
- `systemGenerated`: Boolean flag
- `processed`: Boolean for tracking display status
- `createdAt`: Timestamp with index

**Indexes:**
- Compound indexes for efficient queries
- TTL index: Auto-delete events older than 7 days

---

## Phase 2: New Member Event on Registration ✅ COMPLETED

**File:** `server/routes/auth.js`

**Implementation:**
- Added ActivityEvent import
- After successful user registration, a `new_member` event is created non-blocking via `setImmediate`
- Event includes username and displayName in meta

**Code Added:**
```javascript
// ── COMMUNITY ACTIVITY LAYER: Create new_member event ─────────────────────
setImmediate(async () => {
  try {
    await ActivityEvent.create({
      type: 'new_member',
      userId: user._id,
      meta: { username: user.username, displayName: user.displayName || user.username },
      createdAt: new Date()
    });
  } catch (activityError) {
    logger.warn('[ActivityLayer] Failed to create new_member event:', activityError.message);
  }
});
```

---

## Phase 3: First Post Event - READY TO IMPLEMENT

**Location:** `server/routes/posts.js` - POST /api/posts endpoint

**Logic Required:**
1. Before creating a post, check `Post.countDocuments({ author: userId })`
2. If count === 0, create `first_post` ActivityEvent
3. Feed message: "🎉 {username} shared their first post"

---

## Phase 4: Active Discussion Detection - READY TO IMPLEMENT

**Location:** `server/routes/posts.js` - POST /api/posts/:id/comment endpoint

**Logic Required:**
1. Count comments created in the last hour for the post
2. If comment count >= 5, create `active_discussion` ActivityEvent
3. Feed message: "☕ Ongoing discussion in this post"

---

## Phase 5: Trending Post Detector - PENDING

**File:** `server/jobs/trendingPosts.js`

**Requirements:**
- Background task running every 15 minutes
- Aggregate posts from last 24 hours
- Score formula: `(commentCount * 2) + reactionCount + recencyWeight`
- Select top 3 posts
- Create `trending_post` ActivityEvent
- Feed message: "🔥 This post is trending"

---

## Phase 6: Daily Community Prompt - PENDING

**File:** `server/jobs/dailyPrompt.js`

**Requirements:**
- Run once per day
- Prompt examples:
  - "What's something that made you smile today?"
  - "Share a small win from this week."
  - "What's something you're grateful for today?"
  - "What's been on your mind lately?"
- Create system post with type `community_prompt`

---

## Phase 7: Active User Presence - PENDING

**Requirements:**
- Extend Socket.IO server to track connected users
- Use Set() for memory-efficient user tracking
- Create endpoint: `GET /api/community/active`
- Return format: `{ activeUsers: 4, message: "🌿 4 members active right now" }`

---

## Phase 8: Activity Feed Merge - PENDING

**Requirements:**
- Modify feed endpoint to fetch both posts and ActivityEvents
- Merge arrays and sort by createdAt
- Return mixed feed to frontend

---

## Phase 9: Frontend ActivityCard Component - PENDING

**File:** `src/components/community/ActivityCard.jsx`

**Requirements:**
- Render different UI based on event.type:
  - new_member: User welcome card
  - first_post: Celebration card
  - active_discussion: Discussion indicator
  - trending_post: Trending hot card
  - community_prompt: Prompt card with CTA

---

## Phase 10: Feed Display Integration - PENDING

**Requirements:**
- In FeedList component, detect item.type
- If item is ActivityEvent, render ActivityCard instead of PostCard

---

## Phase 11: Inactivity Email - PENDING

**File:** `server/jobs/reengagement.js`

**Requirements:**
- Find users inactive for 7+ days
- Send email: "Pryde misses you. A few new conversations started recently."

---

## Phase 12: Badge Events - READY TO IMPLEMENT

**Requirements:**
- Add badge triggers:
  - first_post: Emit after user's first post
  - conversation_starter: Emit after post gets 5+ comments
  - early_member: Emit for users who joined in first 30 days
- Create `badge_earned` ActivityEvent

---

## Phase 13: Validation Checklist

- [ ] Feed renders both posts and activity events
- [ ] No existing API contracts broken
- [ ] Socket presence endpoint works
- [ ] Cron jobs scheduled
- [ ] No performance regressions

---

## Implementation Order (Safe Incremental)

1. **Week 1:** Phase 1-2 (Model + Registration event) ✅
2. **Week 2:** Phase 3-4 (First post + Active discussion)
3. **Week 3:** Phase 5-6 (Trending + Daily prompt jobs)
4. **Week 4:** Phase 7-8 (Presence + Feed merge)
5. **Week 5:** Phase 9-10 (Frontend components)
6. **Week 6:** Phase 11-12 (Email + Badge events)
7. **Week 7:** Testing + Validation

---

## Files Created/Modified

| File | Status |
|------|--------|
| `server/models/ActivityEvent.js` | ✅ Created |
| `server/routes/auth.js` | ✅ Modified |

---

## Next Steps

The foundation is laid. The next priority is implementing:
1. First post detection in `posts.js`
2. Active discussion detection in comment endpoint
3. Trending posts background job
4. Daily prompt job
5. Community endpoint for active users
6. Frontend ActivityCard component

All implementations follow the additive principle - no breaking changes to existing functionality.
</parameter>
</create_file>
