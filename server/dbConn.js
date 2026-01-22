// server/dbConn.js
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Support MONGO_URI, MONGO_URL and MONGODB_URI for flexibility
    const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;

    if (!mongoURL) {
      console.error("❌ MONGO_URL or MONGODB_URI is missing in environment variables");
      process.exit(1);
    }

    console.log("📡 Connecting to MongoDB...");

    // OPTIMIZED: Enhanced connection options for production
    const connectionOptions = {
      // Connection pool settings
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '50', 10), // Max connections in pool
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '10', 10), // Min connections to maintain
      maxIdleTimeMS: 60000, // Close idle connections after 60 seconds

      // Timeout settings
      serverSelectionTimeoutMS: 5000, // Timeout for selecting a server (5 seconds)
      socketTimeoutMS: 45000, // Socket timeout (45 seconds)
      connectTimeoutMS: 10000, // Initial connection timeout (10 seconds)

      // Retry settings
      retryWrites: true, // Automatically retry failed writes
      retryReads: true, // Automatically retry failed reads

      // Write concern
      w: 'majority', // Wait for majority of replicas to acknowledge writes

      // Read preference
      readPreference: 'primaryPreferred', // Read from primary, fallback to secondary

      // Compression
      compressors: ['zlib'], // Enable compression for network traffic
      zlibCompressionLevel: 6, // Compression level (1-9, 6 is balanced)

      // Monitoring
      heartbeatFrequencyMS: 10000, // Check server health every 10 seconds

      // Auto-index creation (disable in production for performance)
      autoIndex: process.env.NODE_ENV !== 'production',
    };

    await mongoose.connect(mongoURL, connectionOptions);

    console.log("✅ MongoDB Connected Successfully");
    console.log(`📊 Connection Pool: ${connectionOptions.minPoolSize}-${connectionOptions.maxPoolSize} connections`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);

    // PHASE 4: Initialize core tags after DB connection
    const { initializeTags } = await import('./routes/tags.js');
    await initializeTags();

    // Seed badges on startup (idempotent - skips existing)
    try {
      const { seedAutomaticBadges } = await import('./services/autoBadgeService.js');
      const badgeResult = await seedAutomaticBadges();
      if (badgeResult.created > 0) {
        console.log(`🏅 Badges seeded: ${badgeResult.created} created, ${badgeResult.existing} existing`);
      }
    } catch (badgeError) {
      console.warn("⚠️ Badge seeding skipped:", badgeError.message);
    }

    // 🔧 FIX: Drop legacy token_1 index on sessions collection (one-time cleanup)
    // This index was from an old schema and causes duplicate key errors
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections({ name: 'sessions' }).toArray();
      if (collections.length > 0) {
        const indexes = await db.collection('sessions').indexes();
        const hasLegacyTokenIndex = indexes.some(idx => idx.name === 'token_1');
        if (hasLegacyTokenIndex) {
          await db.collection('sessions').dropIndex('token_1');
          console.log('🔧 Dropped legacy token_1 index from sessions collection');
        }
      }
    } catch (indexError) {
      // Ignore if index doesn't exist or other errors
      if (indexError.code !== 27 && indexError.codeName !== 'IndexNotFound') {
        console.warn("⚠️ Index cleanup skipped:", indexError.message);
      }
    }
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

export default connectDB;
