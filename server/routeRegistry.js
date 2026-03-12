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
import feedPersonalRoutes from './routes/feedPersonal.js';
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
import communityRoutes from './routes/community.js';

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
import notificationSettingsRoutes from './routes/notificationSettings.js';

// ── Discovery & search ───────────────────────────────────────────────────────
import searchRoutes    from './routes/search.js';
import discoveryRoutes from './routes/discovery.js';

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
  app.use('/api/refresh', requireDatabaseReady, refreshRoutes);
  app.use('/api/sessions', requireDatabaseReady, sessionsRoutes);
  app.use('/api/2fa', requireDatabaseReady, twoFactorRoutes);
  app.use('/api/passkey', requireDatabaseReady, passkeyRoutes);
  app.use('/api/login-approval', requireDatabaseReady, loginApprovalRoutes);
  app.use('/api/recovery-contacts', requireDatabaseReady, recoveryContactsRoutes);

  // User & social graph
  app.use('/api/users', requireDatabaseReady, restrictionMiddleware, usersRoutes);
  app.use('/api/profile-slug', requireDatabaseReady, profileSlugRoutes);
  app.use('/api/friends', requireDatabaseReady, friendsRoutes); // backward compat
  app.use('/api/follow', requireDatabaseReady, followRoutes);
  app.use('/api/blocks', requireDatabaseReady, blocksRoutes);
  app.use('/api/privacy', requireDatabaseReady, privacyRoutes);

  // Content
  app.use('/api/posts', requireDatabaseReady, restrictionMiddleware, postsRoutes);
  app.use('/api/feed', requireDatabaseReady, feedRoutes);
  app.use('/api/feed/personal', requireDatabaseReady, feedPersonalRoutes);
  app.use('/api', requireDatabaseReady, commentsRoutes);
  app.use('/api/reactions', requireDatabaseReady, restrictionMiddleware, reactionsRoutes);
  app.use('/api/bookmarks', requireDatabaseReady, bookmarksRoutes);
  app.use('/api/drafts', requireDatabaseReady, draftsRoutes);
  app.use('/api/journals', requireDatabaseReady, journalsRoutes);
  app.use('/api/longform', requireDatabaseReady, longformRoutes);
  app.use('/api/photo-essays', requireDatabaseReady, photoEssaysRoutes);
  app.use('/api/collections', requireDatabaseReady, collectionsRoutes);
  app.use('/api/resonance', requireDatabaseReady, resonanceRoutes);

  // Community
  app.use('/api/groups', requireDatabaseReady, groupsRoutes);
  app.use('/api/circles', requireDatabaseReady, circlesRoutes);
  app.use('/api/events', requireDatabaseReady, eventsRoutes);
  app.use('/api/tags', tagsRoutes); // 410 Gone — no DB access
  app.use('/api/invites', requireDatabaseReady, invitesRoutes);
  app.use('/api/badges', requireDatabaseReady, badgesRoutes);
  app.use('/api/presence', requireDatabaseReady, presenceRoutes);
  app.use('/api/community', requireDatabaseReady, communityRoutes);

  // Messaging
  app.use('/api/messages', requireDatabaseReady, restrictionMiddleware, messagesRoutes);
  app.use('/api/groupchats', requireDatabaseReady, groupChatsRoutes);
  app.use('/api/global-chat', requireDatabaseReady, globalChatRoutes);

  // Media — GET image/file routes are public (img tags don't send auth headers).
  // POST/DELETE routes within uploadRoutes each apply their own auth middleware.
  app.use('/api/upload', requireDatabaseReady, uploadRoutes);

  // Notifications
  app.use('/api/notifications', requireDatabaseReady, notificationsRoutes);
  app.use('/api/push', requireDatabaseReady, pushNotificationsRouter);
  app.use('/api/test-notifications', requireDatabaseReady, testNotificationsRoutes);
  app.use('/api/notifications/settings', requireDatabaseReady, notificationSettingsRoutes);

  // Discovery
  app.use('/api/search',    requireDatabaseReady, searchRoutes);
  app.use('/api/discovery', requireDatabaseReady, discoveryRoutes);

  // Reports & moderation
  app.use('/api/reports', requireDatabaseReady, reportsRoutes);
  app.use('/api/admin', requireDatabaseReady, adminRoutes);
  app.use('/api/admin/posts', requireDatabaseReady, adminPostsRoutes);
  app.use('/api/admin/escalate', requireDatabaseReady, adminEscalationRoutes);
  app.use('/api/admin/debug', requireDatabaseReady, adminDebugRoutes);
  app.use('/api/admin/health', requireDatabaseReady, adminHealthRoutes);
  app.use('/api/admin/moderation-v2', requireDatabaseReady, adminModerationV2Routes);

  // System
  app.use('/api/version', versionRoutes); // static — no DB access
  app.use('/api/audit', requireDatabaseReady, auditRoutes);
  app.use('/api/backup', requireDatabaseReady, backupRoutes);
  app.use('/api/bug-reports', requireDatabaseReady, bugReportsRoutes);
  app.use('/api/safe-mode', requireDatabaseReady, safeModeRoutes);
  app.use('/api/stability', requireDatabaseReady, stabilityControlsRoutes);
  app.use('/api/session-inspector', requireDatabaseReady, sessionInspectorRoutes);
  app.use('/api/system-prompts', requireDatabaseReady, systemPromptsRoutes);
  app.use('/api/prompts', requireDatabaseReady, promptsRoutes);

  // Dev-only routes (never in production)
  if (process.env.NODE_ENV === 'development') {
    app.use('/api/dev', requireDatabaseReady, devVerifyRoutes);
  }
}
