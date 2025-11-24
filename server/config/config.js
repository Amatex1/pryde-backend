export default {
  mongoURI: process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/pryde-social',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  port: process.env.PORT || 9000,
  baseURL: process.env.BASE_URL || 'https://pryde-social.onrender.com',
  frontendURL: process.env.FRONTEND_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development'
};
