# Production Setup Guide - Pryde Social

This guide covers the critical infrastructure configurations needed for production deployment.

---

## 1. Cloudflare R2 + CDN Configuration

### Prerequisites
- Cloudflare account with R2 storage enabled
- Custom domain for media (e.g., `media.prydeapp.com`)

### Step 1: Create R2 Bucket
1. Log into Cloudflare Dashboard → R2
2. Create bucket: `pryde-social-media`
3. Note your R2 credentials

### Step 2: Configure Custom Domain
1. In R2 bucket settings, add custom domain
2. Example: `media.prydeapp.com`
3. Cloudflare will provision an SSL certificate

### Step 3: Set Environment Variables

```
bash
# R2 Storage
R2_ENABLED=true
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=pryde-social-media

# CDN URL (pointing to your custom domain)
R2_PUBLIC_URL=https://media.prydeapp.com
```

### Step 4: Verify Configuration

The R2 storage is already integrated in:
- `pryde-backend/server/utils/r2Storage.js`
- `pryde-backend/server/routes/upload.js`

---

## 2. Redis Configuration for Production

### Why Redis is Required
- **Rate Limiting**: Distributed rate limiting across instances
- **Feed Caching**: Reduces DB load by ~70%
- **Session Storage**: Sticky sessions alternative

### Environment Variables

```
bash
# Option A: REDIS_URL (Render, Railway, Upstash)
REDIS_URL=rediss://username:password@host:port

# Option B: Individual components
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Optional: TLS for cloud Redis
REDIS_TLS=true
```

### Production Validation

The server will warn if Redis is not configured in production:

```
WARNING: Redis not configured - rate limiting will use in-memory store 
(not recommended for multi-instance deployments)
```

### Redis Connection Details

| Component | File Location |
|-----------|---------------|
| Rate Limiting | `pryde-backend/server/middleware/rateLimiter.js` |
| Feed Caching | `pryde-backend/server/utils/redisCache.js` |
| User Caching | `pryde-backend/server/utils/userCache.js` |

---

## 3. Feed Query Indexes

### Purpose
Optimize MongoDB queries for feed loading:
- Reduce feed load time by 40-60%
- Support pagination efficiently
- Enable real-time sorting

### Indexes Already Created

The migration `add_feed_indexes.js` creates:

| Index Name | Fields | Purpose |
|------------|--------|---------|
| `feed_home_following` | author, visibility, groupId, createdAt | Home/Following feed |
| `feed_global` | visibility, createdAt, groupId | Public global feed |
| `feed_user_profile` | author, createdAt | User profile posts |
| `feed_trending` | likesCount, createdAt | Trending posts |
| `comments_by_post` | parentPost, createdAt | Post comments |
| `invalidation_author` | author, createdAt | Cache invalidation |

### Verify Indexes

Run the verification script:

```
bash
node server/migrations/scripts/verifyIndexes.js
```

Or check manually in MongoDB shell:

```
javascript
db.posts.getIndexes()
```

---

## 4. Image Optimization

### Current Implementation

The platform already implements:

| Feature | Status | Location |
|---------|--------|----------|
| EXIF Stripping | ✅ | `middleware/imageProcessing.js` |
| WebP Conversion | ✅ | Same |
| AVIF Support | ✅ | `OptimizedImage.jsx` |
| Responsive Sizes | ✅ | `upload.js` (thumbnail, small, medium) |
| Lazy Loading | ✅ | `OptimizedImage.jsx` |

### Responsive Size Mapping

| Size | Dimensions | Use Case |
|------|------------|----------|
| `thumbnail` | Avatar optimized | Profile pictures |
| `small` | ~300px | Feed thumbnails |
| `medium` | ~600px | Full post view |
| `full` | Original | Lightbox view |

---

## 5. Multi-Instance Deployment

### Requirements for Horizontal Scaling

1. **Redis Required**:
   - Session management
   - Rate limiting
   - Feed cache

2. **Sticky Sessions**:
   - Or Redis adapter for Socket.IO
   - See `pryde-backend/server/socket/index.js`

3. **Load Balancer Health Checks**:
   - `/api/admin/health` endpoint
   - See `pryde-backend/server/routes/adminHealth.js`

### Scaling Estimates

| Configuration | Max Users |
|---------------|-----------|
| Single instance | 10,000 |
| 2 instances + Redis | 25,000 |
| 5 instances + Redis + CDN | 100,000+ |

---

## 6. Environment Checklist

### Required in Production

```
bash
# Database
MONGODB_URI=mongodb+srv://...

# Authentication
JWT_SECRET=secure_random_string
JWT_REFRESH_SECRET=secure_random_string
CSRF_SECRET=secure_random_string

# Redis (REQUIRED for multi-instance)
REDIS_URL=rediss://...

# R2 Storage
R2_ENABLED=true
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=pryde-social-media
R2_PUBLIC_URL=https://media.yourdomain.com
```

### Optional but Recommended

```
bash
# Firebase (Push Notifications)
FIREBASE_SERVICE_ACCOUNT_JSON={...}

# External Services
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
```

---

## 7. Verification Commands

### Check Redis Connection
```
bash
# In server console, look for:
✅ Redis connected for rate limiting
✅ Redis connected for feed caching
```

### Check R2 Storage
```
bash
# Upload a test image
# Verify URL is: https://media.yourdomain.com/{filename}
```

### Check Indexes
```
bash
node server/migrations/scripts/verifyIndexes.js
# Expected output: All indexes created successfully
```

---

## 8. Troubleshooting

### Redis Connection Failed
```
Error: Redis connection failed
```
**Solution**: Verify REDIS_URL or REDIS_HOST/PORT in environment

### R2 Upload Failed
```
Error: R2 not initialized
```
**Solution**: Verify R2_ENABLED=true and credentials

### Slow Feed Queries
```
Warning: Feed query took > 500ms
```
**Solution**: Run index migration `node server/migrations/add_feed_indexes.js`

### Missing Image Sizes
```
Error: Cannot read properties of undefined (reading 'webp')
```
**Solution**: Regenerate images via re-upload (responsive sizes created on upload)

---

*Last Updated: Platform Feature Audit*
