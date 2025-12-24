/**
 * Role and Permission Configuration
 * Centralized role matrix for the audit system
 */

export const ROLES = ['user', 'moderator', 'admin', 'super_admin'];

export const ROLE_MATRIX = {
  super_admin: {
    // Feature capabilities (should all be true for active, non-banned users)
    post: true,
    message: true,
    upload: true,
    reply: true,
    chat: true,
    comment: true,
    // Role-based permissions
    edit_any_post: true,
    delete_any_post: true,
    view_reports: true,
    resolve_reports: true,
    manage_users: true,
    view_analytics: true,
    manage_admins: true,
    // Permission flags
    canViewReports: true,
    canResolveReports: true,
    canManageUsers: true,
    canViewAnalytics: true,
    canManageAdmins: true,
  },
  admin: {
    // Feature capabilities
    post: true,
    message: true,
    upload: true,
    reply: true,
    chat: true,
    comment: true,
    // Role-based permissions
    edit_any_post: true,
    delete_any_post: true,
    view_reports: true,
    resolve_reports: true,
    manage_users: true,
    view_analytics: true,
    manage_admins: false,
    // Permission flags
    canViewReports: true,
    canResolveReports: true,
    canManageUsers: true,
    canViewAnalytics: true,
    canManageAdmins: false,
  },
  moderator: {
    // Feature capabilities
    post: true,
    message: true,
    upload: true,
    reply: true,
    chat: true,
    comment: true,
    // Role-based permissions
    edit_any_post: true,
    delete_any_post: true,
    view_reports: true,
    resolve_reports: true,
    manage_users: false,
    view_analytics: true,
    manage_admins: false,
    // Permission flags
    canViewReports: true,
    canResolveReports: true,
    canManageUsers: false,
    canViewAnalytics: true,
    canManageAdmins: false,
  },
  user: {
    // Feature capabilities
    post: true,
    message: true,
    upload: true,
    reply: true,
    chat: true,
    comment: true,
    // Role-based permissions
    edit_any_post: false,
    delete_any_post: false,
    view_reports: false,
    resolve_reports: false,
    manage_users: false,
    view_analytics: false,
    manage_admins: false,
    // Permission flags
    canViewReports: false,
    canResolveReports: false,
    canManageUsers: false,
    canViewAnalytics: false,
    canManageAdmins: false,
  },
};

export default {
  ROLES,
  ROLE_MATRIX,
};

