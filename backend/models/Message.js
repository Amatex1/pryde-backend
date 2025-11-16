import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, default: null },
  image_url: { type: String, default: null },
  read_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  created_at: { type: Date, default: Date.now }
});

// Index for efficient queries
MessageSchema.index({ from: 1, to: 1, created_at: -1 });
MessageSchema.index({ to: 1, created_at: -1 });

export default mongoose.model("Message", MessageSchema);
