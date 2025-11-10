import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import Message from "../models/Message.js";

const router = express.Router();

// Temporary storage for uploaded files
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /messages/send-image
 * Upload image → WP Media Library → Save message → Return JSON
 */
router.post("/send-image", upload.single("image"), async (req, res) => {
    try {
        const file = req.file;
        const { conversationId, senderId } = req.body;

        if (!file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        if (!conversationId || !senderId) {
            return res.status(400).json({ error: "Missing conversationId or senderId" });
        }

        // ✅ Send image to WordPress Media Library
        const wpMediaResponse = await fetch(
            "https://prydeapp.com/wp-json/wp/v2/media",
            {
                method: "POST",
                headers: {
                    "Content-Disposition": `attachment; filename="${file.originalname}"`,
                    "Content-Type": file.mimetype,
                    "Authorization": `Basic ${process.env.WP_MEDIA_TOKEN}` 
                },
                body: file.buffer
            }
        );

        const wpMediaJson = await wpMediaResponse.json();

        if (!wpMediaJson.source_url) {
            console.error("WP Media Upload Failed:", wpMediaJson);
            return res.status(500).json({ error: "Failed to upload image to WordPress." });
        }

        // ✅ Save message to MongoDB
        const newMessage = new Message({
            conversationId,
            senderId,
            imageUrl: wpMediaJson.source_url,
            timestamp: new Date()
        });

        await newMessage.save();

        res.json({
            success: true,
            message: "Image sent.",
            imageUrl: wpMediaJson.source_url,
            messageId: newMessage._id
        });

    } catch (err) {
        console.error("❌ send-image error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

export default router;
