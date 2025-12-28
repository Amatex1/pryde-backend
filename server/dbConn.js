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

    await mongoose.connect(mongoURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ MongoDB Connected Successfully");

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
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

export default connectDB;
