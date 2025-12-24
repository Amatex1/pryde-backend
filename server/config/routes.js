/**
 * Route Configuration
 * Centralized route definitions for audit system
 */

export const FRONTEND_ROUTES = [
  // Public routes
  { path: '/', component: 'Home', requiresAuth: false, public: true },
  { path: '/login', component: 'Login', requiresAuth: false, public: true },
  { path: '/register', component: 'Register', requiresAuth: false, public: true },
  { path: '/forgot-password', component: 'ForgotPassword', requiresAuth: false, public: true },
  { path: '/reset-password', component: 'ResetPassword', requiresAuth: false, public: true },
  
  // Protected routes
  { path: '/feed', component: 'Feed', requiresAuth: true, public: false },
  { path: '/feed/following', component: 'FollowingFeed', requiresAuth: true, public: false },
  { path: '/journal', component: 'Journal', requiresAuth: true, public: false },
  { path: '/longform', component: 'Longform', requiresAuth: true, public: false },
  { path: '/discover', component: 'Discover', requiresAuth: true, public: false },
  { path: '/tags/:slug', component: 'TagFeed', requiresAuth: true, public: false },
  { path: '/photo-essay', component: 'PhotoEssay', requiresAuth: true, public: false },
  { path: '/photo-essay/:id', component: 'PhotoEssay', requiresAuth: true, public: false },
  { path: '/profile/:id', component: 'Profile', requiresAuth: true, public: false },
  { path: '/profile/:username/followers', component: 'Followers', requiresAuth: true, public: false },
  { path: '/profile/:username/following', component: 'Following', requiresAuth: true, public: false },
  { path: '/settings', component: 'Settings', requiresAuth: true, public: false },
  { path: '/settings/security', component: 'SecuritySettings', requiresAuth: true, public: false },
  { path: '/settings/privacy', component: 'PrivacySettings', requiresAuth: true, public: false },
  { path: '/bookmarks', component: 'Bookmarks', requiresAuth: true, public: false },
  { path: '/events', component: 'Events', requiresAuth: true, public: false },
  { path: '/messages', component: 'Messages', requiresAuth: true, public: false },
  { path: '/lounge', component: 'Lounge', requiresAuth: true, public: false },
  { path: '/notifications', component: 'Notifications', requiresAuth: true, public: false },
  { path: '/hashtag/:tag', component: 'Hashtag', requiresAuth: true, public: false },
  { path: '/reactivate', component: 'ReactivateAccount', requiresAuth: true, public: false },
  
  // Admin routes
  { path: '/admin', component: 'Admin', requiresAuth: true, requiresRole: 'moderator', public: false },
  
  // Legal pages (public)
  { path: '/terms', component: 'Terms', requiresAuth: false, public: true },
  { path: '/privacy', component: 'Privacy', requiresAuth: false, public: true },
  { path: '/community', component: 'Community', requiresAuth: false, public: true },
  { path: '/community-guidelines', component: 'Community', requiresAuth: false, public: true },
  { path: '/safety', component: 'Safety', requiresAuth: false, public: true },
  { path: '/security', component: 'Security', requiresAuth: false, public: true },
  { path: '/contact', component: 'Contact', requiresAuth: false, public: true },
  { path: '/faq', component: 'FAQ', requiresAuth: false, public: true },
  { path: '/legal-requests', component: 'LegalRequests', requiresAuth: false, public: true },
  { path: '/dmca', component: 'DMCA', requiresAuth: false, public: true },
  { path: '/acceptable-use', component: 'AcceptableUse', requiresAuth: false, public: true },
  { path: '/cookie-policy', component: 'CookiePolicy', requiresAuth: false, public: true },
  { path: '/helplines', component: 'Helplines', requiresAuth: false, public: true },
];

export const API_ROUTES = [
  { path: '/api/auth', method: 'POST', requiresAuth: false },
  { path: '/api/refresh', method: 'POST', requiresAuth: false },
  { path: '/api/users', method: 'GET', requiresAuth: true },
  { path: '/api/friends', method: 'GET', requiresAuth: true },
  { path: '/api/follow', method: 'POST', requiresAuth: true },
  { path: '/api/posts', method: 'GET', requiresAuth: true },
  { path: '/api/feed', method: 'GET', requiresAuth: true },
  { path: '/api/journals', method: 'GET', requiresAuth: true },
  { path: '/api/longform', method: 'GET', requiresAuth: true },
  { path: '/api/tags', method: 'GET', requiresAuth: true },
  { path: '/api/photo-essays', method: 'GET', requiresAuth: true },
  { path: '/api/upload', method: 'POST', requiresAuth: true },
  { path: '/api/notifications', method: 'GET', requiresAuth: true },
  { path: '/api/messages', method: 'GET', requiresAuth: true },
  { path: '/api/groupchats', method: 'GET', requiresAuth: true },
  { path: '/api/global-chat', method: 'GET', requiresAuth: true },
  { path: '/api/push', method: 'POST', requiresAuth: true },
  { path: '/api/reports', method: 'POST', requiresAuth: true },
  { path: '/api/blocks', method: 'GET', requiresAuth: true },
  { path: '/api/admin', method: 'GET', requiresAuth: true, requiresRole: 'moderator' },
  { path: '/api/search', method: 'GET', requiresAuth: true },
  { path: '/api/2fa', method: 'POST', requiresAuth: true },
  { path: '/api/sessions', method: 'GET', requiresAuth: true },
  { path: '/api/privacy', method: 'GET', requiresAuth: true },
  { path: '/api/bookmarks', method: 'GET', requiresAuth: true },
  { path: '/api/events', method: 'GET', requiresAuth: true },
  { path: '/api/login-approval', method: 'POST', requiresAuth: true },
  { path: '/api/drafts', method: 'GET', requiresAuth: true },
  { path: '/api/recovery-contacts', method: 'GET', requiresAuth: true },
  { path: '/api/passkey', method: 'POST', requiresAuth: false },
  { path: '/api/health', method: 'GET', requiresAuth: false },
  { path: '/api/status', method: 'GET', requiresAuth: false },
];

export default FRONTEND_ROUTES;

