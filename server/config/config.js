// Validate required environment variables in production
const validateConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!process.env.JWT_SECRET) {
      throw new Error('CRITICAL: JWT_SECRET environment variable is required in production!');
    }
    if (!process.env.MONGODB_URI && !process.env.MONGO_URL) {
      throw new Error('CRITICAL: MONGODB_URI or MONGO_URL environment variable is required in production!');
    }
  }
};

// Run validation
validateConfig();

export default {
  mongoURI: process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/pryde-social',
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_SECRET is required in production!') })()
    : 'dev-secret-key-CHANGE-IN-PRODUCTION'),
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_REFRESH_SECRET is required in production!') })()
    : 'dev-refresh-secret-key-CHANGE-IN-PRODUCTION'),
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '30d',
  termsVersion: process.env.TERMS_VERSION || '1.0',
  privacyVersion: process.env.PRIVACY_VERSION || '1.0',
  port: process.env.PORT || 9000,
  baseURL: process.env.BASE_URL || 'https://pryde-social.onrender.com',
  frontendURL: process.env.FRONTEND_URL || 'http://localhost:5173',
  cloudflareURL: process.env.CLOUDFLARE_URL || 'https://pryde-social.pages.dev',
  nodeEnv: process.env.NODE_ENV || 'development'
};
