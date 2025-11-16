import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/pryde';
    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB connected to:", mongoUri);
  } catch(e) { 
    console.error("❌ MongoDB Error:", e); 
    process.exit(1);
  }
};