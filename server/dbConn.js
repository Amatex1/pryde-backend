// server/dbConn.js
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Support both MONGO_URL and MONGODB_URI for flexibility
    const mongoURL = process.env.MONGO_URL || process.env.MONGODB_URI;

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
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

export default connectDB;
