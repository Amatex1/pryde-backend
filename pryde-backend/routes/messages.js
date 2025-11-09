import express from "express";
import {auth} from "../middleware/auth.js";
import {sanitizeInput} from "../middleware/sanitize.js";
import {getMessages,sendMessage} from "../controllers/messagesController.js";
const r=express.Router();
r.get("/:conversationId/user/:userId",auth,getMessages);
r.post("/send",auth,sanitizeInput,sendMessage);
export default r;