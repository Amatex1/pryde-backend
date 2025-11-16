import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  display_name: {
    type: String,
    required: true,
    trim: true
  },
  avatar_url: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: '',
    maxlength: 500
  },
  banned: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model("User", userSchema);