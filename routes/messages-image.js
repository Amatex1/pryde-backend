import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import Message from "../models/Message.js";

const router = express.Router();

// Temporary memory storage (for uploaded image)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /messages/send-image
 * Receives: image, conversationId, senderId
 * Uploads image → WordPress
 * Saves to MongoDB
 */
router.post("/send-image", upload.single("image"), async (req, res) => {
    try {
        const file = req.file;
        const { conversationId, senderId } = req.body;

        if (!file) {
            return res.status(400).json({ error: "No image uploaded." });
        }

        if (!conversationId || !senderId) {
            return res.status(400).json({ error: "Missing conversationId or senderId" });
        }

        // Upload to WordPress Media Library
        const wpUpload = await fetch("https://prydeapp.com/wp-json/wp/v2/media", {
            method: "POST",
            headers: {
                "Content-Disposition": `attachment; filename="${file.originalname}"`,
                "Content-Type": file.mimetype,
                "Authorization": `Basic ${process.env.WP_MEDIA_TOKEN}`
            },
            body: file.buffer
        });

        const wpJson = await wpUpload.json();

        if (!wpJson.source_url) {
            console.error("WordPress upload failed:", wpJson);
            return res.status(500).json({ error: "Failed to upload to WordPress." });
        }

        // Save message to MongoDB
        const newMessage = new Message({
            conversationId,
            senderId,
            imageUrl: wpJson.source_url,
            timestamp: new Date()
        });

        await newMessage.save();

        return res.json({
            success: true,
            imageUrl: wpJson.source_url,
            messageId: newMessage._id
        });

    } catch (err) {
        console.error("send-image error:", err);
        return res.status(500).json({ error: "Server error." });
    }
});

export default router;
