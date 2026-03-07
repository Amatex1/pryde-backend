# Pryde Backend TODO

## Infrastructure
- Database read replicas (infrastructure decision - not code related)

## Completed Features
✓ Email notification service (already implemented)
✓ Feed cache warming (scheduled warmup, user feed warmup, global feed warmup)
✓ Redis hit-rate metrics (getWarmupStatus function)
✓ Query monitoring (metrics in redisCache.js)
✓ Appeals workflow (recordAppeal, resolveAppeal, handleOverturned in moderationAnalytics.js)
✓ Moderation analytics dashboard (getModerationAnalytics, getAppealsAnalytics in moderationAnalytics.js)
