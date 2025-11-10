import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
    conversationId: { type: String, required: true },
    senderId: { type: String, required: true },
    text: { type: String, default: null },
    imageUrl: { type: String, default: null },
    timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("Message", MessageSchema);
