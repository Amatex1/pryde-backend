# Changelog

All notable changes to Pryde Social will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-rc.1] - 2025-12-30

### Status: RELEASE CANDIDATE

This is the first release candidate for Pryde Social v1.0.0. Feature freeze is in effect.

### Added
- **Authentication System**: Passkey support, 2FA, session management
- **Social Features**: Posts, comments, reactions, bookmarks
- **Messaging**: Real-time messaging with WebSocket support
- **Groups & Events**: Community features with RSVP
- **Profile System**: Customizable profiles, avatar uploads
- **Feed System**: Following feed, discover feed, tag feeds
- **Notifications**: Push notifications, in-app notifications
- **Search**: Global search across users and posts
- **Admin Panel**: User management, content moderation

### Security
- HttpOnly refresh tokens
- CSRF protection
- Rate limiting
- Input sanitization
- XSS prevention

### Developer Experience
- Release guard system (audit enforcement)
- Feature freeze configuration
- Theme leak detection
- Code health auditing
- Runtime auth testing

### Infrastructure
- MongoDB with Mongoose ODM
- Cloudinary for media storage
- WebSocket (Socket.io) for real-time features
- Redis-compatible session store

### Known Issues
- Theme leak warnings in legacy CSS files (documented exceptions)
- Some TODOs remain in codebase (tracked in code health audit)

### Migration Notes
- No breaking changes from development builds
- Database migrations run automatically on first start

---

## [Unreleased]

_No unreleased changes yet. All changes are in 1.0.0-rc.1._

---

## Release Process

1. Run `npm run audit:final` to generate audit report
2. Run `npm run release:check` to verify release gates
3. All gates must pass before release
4. Manual approval required (auto-deploy disabled)

---

_For detailed commit history, see the [GitHub repository](https://github.com/Amatex1/pryde-backend)._

