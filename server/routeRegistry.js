/**
 * Route Registry
 *
 * Centralises all route imports and app.use() mounts.
 * Extracted from server.js to keep server.js under 500 lines.
 *
 * Usage:
 *   import { mountRoutes } from './routeRegistry.js';
 *   mountRoutes(app, { restrictionMiddleware, requireDatabaseReady });
 */

// ── Core auth ───────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.js';
import refreshRoutes from './routes/refresh.js';
import sessionsRoutes from './routes/sessions.js';
import twoFactorRoutes from './routes/twoFactor.js';
import passkeyRoutes from './routes/passkey.js';
import loginApprovalRoutes from './routes/loginApproval.js';
import recoveryContactsRoutes from './routes/recoveryContacts.js';

// ── User & social graph ─────────────────────────────────────────────────────
import usersRoutes from './routes/users.js';
import profileSlugRoutes from './routes/profileSlug.js';
import friendsRoutes from './routes/friends.js'; // kept for backward compatibility
import followRoutes from './routes/follow.js';
import blocksRoutes from './routes/blocks.js';
import privacyRoutes from './routes/privacy.js';

// ── Content ─────────────────────────────────────────────────────────────────
import postsRoutes from './routes/posts.js';
import feedRoutes from './routes/feed.js';
import commentsRoutes from './routes/comments.js';
import reactionsRoutes from './routes/reactions.js';
import bookmarksRoutes from './routes/bookmarks.js';
import draftsRoutes from './routes/drafts.js';
import journalsRoutes from './routes/journals.js';
import longformRoutes from './routes/longform.js';
import photoEssaysRoutes from './routes/photoEssays.js';
import collectionsRoutes from './routes/collections.js';
import resonanceRoutes from './routes/resonance.js';

// ── Community features ───────────────────────────────────────────────────────
import groupsRoutes from './routes/groups.js';
import circlesRoutes from './routes/circles.js';
import eventsRoutes from './routes/events.js';
import tagsRoutes from './routes/tags.js'; // deprecated — returns 410 Gone
import invitesRoutes from './routes/invites.js';
import badgesRoutes from './routes/badges.js';
import presenceRoutes from './routes/presence.js';

// ── Messaging ────────────────────────────────────────────────────────────────
import messagesRoutes from './routes/messages.js';
import groupChatsRoutes from './routes/groupChats.js';
import globalChatRoutes from './routes/globalChat.js';

// ── Media & upload ───────────────────────────────────────────────────────────
import uploadRoutes from './routes/upload.js';

// ── Notifications & push ─────────────────────────────────────────────────────
import notificationsRoutes from './routes/notifications.js';
import pushNotificationsRouter from './routes/pushNotifications.js';
import testNotificationsRoutes from './routes/testNotifications.js';

// ── Discovery & search ───────────────────────────────────────────────────────
import searchRoutes from './routes/search.js';

// ── Reports, moderation, admin ───────────────────────────────────────────────
import reportsRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import adminPostsRoutes from './routes/adminPosts.js';
import adminEscalationRoutes from './routes/adminEscalation.js';
import adminDebugRoutes from './routes/adminDebug.js';
import adminHealthRoutes from './routes/adminHealth.js';
import adminModerationV2Routes from './routes/adminModerationV2.js';

// ── System & infrastructure ───────────────────────────────────────────────────
import versionRoutes from './routes/version.js';
import auditRoutes from './routes/audit.js';
import backupRoutes from './routes/backup.js';
import bugReportsRoutes from './routes/bugReports.js';
import safeModeRoutes from './routes/safeMode.js';
import stabilityControlsRoutes from './routes/stabilityControls.js';
import sessionInspectorRoutes from './routes/sessionInspector.js';
import systemPromptsRoutes from './routes/systemPrompts.js';
import promptsRoutes from './routes/prompts.js';

// ── Dev-only ─────────────────────────────────────────────────────────────────
import devVerifyRoutes from './routes/devVerify.js';

/**
 * Mount all application routes on `app`.
 *
 * @param {import('express').Application} app
 * @param {{ restrictionMiddleware: Function, requireDatabaseReady: Function }} deps
 */
export function mountRoutes(app, { restrictionMiddleware, requireDatabaseReady }) {
  // Auth
  app.use('/api/auth', requireDatabaseReady, authRoutes);
  app.use('/api/refresh', refreshRoutes);
  app.use('/api/sessions', sessionsRoutes);
  app.use('/api/2fa', twoFactorRoutes);
  app.use('/api/passkey', passkeyRoutes);
  app.use('/api/login-approval', loginApprovalRoutes);
  app.use('/api/recovery-contacts', recoveryContactsRoutes);

  // User & social graph
  app.use('/api/users', restrictionMiddleware, usersRoutes);
  app.use('/api/profile-slug', profileSlugRoutes);
  app.use('/api/friends', friendsRoutes); // backward compat
  app.use('/api/follow', followRoutes);
  app.use('/api/blocks', blocksRoutes);
  app.use('/api/privacy', privacyRoutes);

  // Content
  app.use('/api/posts', restrictionMiddleware, postsRoutes);
  app.use('/api/feed', feedRoutes);
  app.use('/api', commentsRoutes);
  app.use('/api/reactions', restrictionMiddleware, reactionsRoutes);
  app.use('/api/bookmarks', bookmarksRoutes);
  app.use('/api/drafts', draftsRoutes);
  app.use('/api/journals', journalsRoutes);
  app.use('/api/longform', longformRoutes);
  app.use('/api/photo-essays', photoEssaysRoutes);
  app.use('/api/collections', collectionsRoutes);
  app.use('/api/resonance', resonanceRoutes);

  // Community
  app.use('/api/groups', groupsRoutes);
  app.use('/api/circles', circlesRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/tags', tagsRoutes); // 410 Gone
  app.use('/api/invites', invitesRoutes);
  app.use('/api/badges', badgesRoutes);
  app.use('/api/presence', presenceRoutes);

  // Messaging
  app.use('/api/messages', restrictionMiddleware, messagesRoutes);
  app.use('/api/groupchats', groupChatsRoutes);
  app.use('/api/global-chat', globalChatRoutes);

  // Media — GET image/file routes are public (img tags don't send auth headers).
  // POST/DELETE routes within uploadRoutes each apply their own auth middleware.
  app.use('/api/upload', uploadRoutes);

  // Notifications
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/push', pushNotificationsRouter);
  app.use('/api/test-notifications', testNotificationsRoutes);

  // Discovery
  app.use('/api/search', searchRoutes);

  // Reports & moderation
  app.use('/api/reports', reportsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/admin/posts', adminPostsRoutes);
  app.use('/api/admin/escalate', adminEscalationRoutes);
  app.use('/api/admin/debug', adminDebugRoutes);
  app.use('/api/admin/health', adminHealthRoutes);
  app.use('/api/admin/moderation-v2', adminModerationV2Routes);

  // System
  app.use('/api/version', versionRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/backup', backupRoutes);
  app.use('/api/bug-reports', bugReportsRoutes);
  app.use('/api/safe-mode', safeModeRoutes);
  app.use('/api/stability', stabilityControlsRoutes);
  app.use('/api/session-inspector', sessionInspectorRoutes);
  app.use('/api/system-prompts', systemPromptsRoutes);
  app.use('/api/prompts', promptsRoutes);

  // Dev-only routes (never in production)
  if (process.env.NODE_ENV === 'development') {
    app.use('/api/dev', devVerifyRoutes);
  }
}
