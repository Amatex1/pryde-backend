import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/pryde';
    await mongoose.connect(mongoURI);
    console.log("✅ MongoDB connected to:", mongoURI);
  } catch (e) {
    console.error("❌ MongoDB connection error:", e);
    process.exit(1);
  }
};