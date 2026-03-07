// Validate required environment variables in production
const validateConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // JWT and Database Validations
    if (!process.env.JWT_SECRET) {
      throw new Error('CRITICAL: JWT_SECRET environment variable is required in production!');
    }
    if (!process.env.MONGODB_URI && !process.env.MONGO_URL) {
      throw new Error('CRITICAL: MONGODB_URI or MONGO_URL environment variable is required in production!');
    }

    // Redis Validations - REQUIRED in production for multi-instance deployments
    const hasRedisUrl = process.env.REDIS_URL && /^rediss?:\/\//i.test(process.env.REDIS_URL);
    const hasRedisHost = process.env.REDIS_HOST && process.env.REDIS_PORT;
    
    if (!hasRedisUrl && !hasRedisHost) {
      throw new Error('CRITICAL: Redis is required in production for multi-instance deployments! Set REDIS_URL or REDIS_HOST/REDIS_PORT. See PRODUCTION_SETUP_GUIDE.md for details.');
    }

    // Security Validations
    if (!process.env.CSRF_SECRET) {
      throw new Error('CRITICAL: CSRF_SECRET environment variable is required in production!');
    }
    
    // R2/CDN Validation - RECOMMENDED for production
    if (process.env.R2_ENABLED !== 'true') {
      console.warn('WARNING: R2 storage not enabled - media will use GridFS (slower, no CDN). Set R2_ENABLED=true for production.');
    }
  }
};

// Run validation
validateConfig();

export default {
  // Database Configuration
  mongoURI: process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/pryde-social',
  
  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_SECRET is required in production!') })()
    : 'dev-secret-key-CHANGE-IN-PRODUCTION'),
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_REFRESH_SECRET is required in production!') })()
    : 'dev-refresh-secret-key-CHANGE-IN-PRODUCTION'),
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '30d',

  // Redis Configuration (optional - falls back to in-memory if not configured)
  // Supports both:
  // 1. REDIS_URL (Render, Railway, etc.) - single connection string
  // 2. REDIS_HOST + REDIS_PORT (custom Redis deployments)
  redis: process.env.REDIS_URL ? {
    url: process.env.REDIS_URL,
    // Also expose individual components for compatibility
    host: null,
    port: null,
    password: null
  } : (process.env.REDIS_HOST && process.env.REDIS_PORT ? {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10),
    password: process.env.REDIS_PASSWORD || null,
    // TLS/SSL support for cloud Redis providers (Upstash, Redis Cloud, etc.)
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    // Additional Redis connection options
    connectionTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000', 10),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10)
  } : null),

  // Security Configurations
  security: {
    // CSRF Protection
    csrfSecret: process.env.CSRF_SECRET || (process.env.NODE_ENV === 'production'
      ? (() => { throw new Error('CSRF_SECRET is required in production!') })()
      : 'dev-csrf-secret-CHANGE-IN-PRODUCTION'),
    
    // Rate Limiting
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes default
    globalRateLimit: parseInt(process.env.GLOBAL_RATE_LIMIT || '500', 10),
    
    // Brute Force Protection
    loginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '10', 10),
    loginLockoutDuration: parseInt(process.env.LOGIN_LOCKOUT_DURATION || '900000', 10), // 15 minutes
    
    // Password Policies
    minPasswordLength: parseInt(process.env.MIN_PASSWORD_LENGTH || '12', 10),
    requireSpecialChar: process.env.REQUIRE_SPECIAL_CHAR === 'true',
    requireUppercase: process.env.REQUIRE_UPPERCASE === 'true',
    requireNumber: process.env.REQUIRE_NUMBER === 'true'
  },

  // Application Metadata
  termsVersion: process.env.TERMS_VERSION || '1.0',
  privacyVersion: process.env.PRIVACY_VERSION || '1.0',

  // Platform Mode Configuration (Phase 7B)
  platform: {
    // When true, only users with valid invite codes can register
    // When false, invites are optional (just for user-to-user referrals)
    inviteOnlyMode: process.env.INVITE_ONLY_MODE === 'true', // Default: false (open registration)
    // Cooldown between invite generations (in milliseconds) - 7 days default
    inviteCooldownMs: parseInt(process.env.INVITE_COOLDOWN_MS || '604800000', 10),
    // Default invite expiry (in milliseconds) - 30 days default
    inviteExpiryMs: parseInt(process.env.INVITE_EXPIRY_MS || '2592000000', 10),
    // Maximum active (unused) invites per user
    maxActiveInvivesPerUser: parseInt(process.env.MAX_ACTIVE_INVITES_PER_USER || '1', 10),
  },

  // Server Configuration
  port: process.env.PORT || 9000,
  baseURL: process.env.BASE_URL || 'https://pryde-social.onrender.com',
  frontendURL: process.env.FRONTEND_URL || 'http://localhost:5173',
  apiDomain: process.env.API_DOMAIN || null, // Custom domain for backend (e.g., api.prydeapp.com)
  nodeEnv: process.env.NODE_ENV || 'development',

  // Firebase Cloud Messaging (FCM) — for native Android/iOS push notifications
  firebase: {
    serviceAccountJSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || null,
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || null,
  },

  // Logging and Monitoring
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'debug'),
    enableSecurityLogs: process.env.ENABLE_SECURITY_LOGS === 'true',
    logRotationMaxFiles: parseInt(process.env.LOG_ROTATION_MAX_FILES || '5', 10)
  },

  // Cloudflare R2 Configuration (for media storage)
  // R2 provides S3-compatible API with no egress fees
  r2: {
    enabled: process.env.R2_ENABLED === 'true',
    accountId: process.env.R2_ACCOUNT_ID || null,
    accessKeyId: process.env.R2_ACCESS_KEY_ID || null,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || null,
    bucketName: process.env.R2_BUCKET_NAME || 'pryde-social-media',
    publicUrl: process.env.R2_PUBLIC_URL || null, // Custom CDN URL (e.g., https://media.prydeapp.com)
  },

  // Email Configuration (SMTP)
  email: {
    host: process.env.SMTP_HOST || null,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || null,
      pass: process.env.SMTP_PASS || null,
    },
    from: process.env.SMTP_FROM || 'noreply@prydeapp.com',
  },

  // App URL for email links
  app: {
    url: process.env.APP_URL || 'https://prydeapp.com',
  }
};
