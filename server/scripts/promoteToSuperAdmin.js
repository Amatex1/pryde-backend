import mongoose from "mongoose";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

async function promote() {
  await mongoose.connect(process.env.MONGO_URI);

  const email = process.argv[2];

  const user = await User.findOne({ email });

  if (!user) {
    console.log("User not found");
    process.exit(1);
  }

  user.role = "super_admin";
  await user.save();

  console.log(`${email} promoted to super_admin`);
  process.exit(0);
}

promote();
