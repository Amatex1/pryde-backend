import express from "express";
import {auth} from "../middleware/auth.js";
import {validateId} from "../middleware/validateId.js";
import {getUserConversations,startConversation} from "../controllers/conversationsController.js";
const r=express.Router();
r.get("/user/:userId",auth,validateId,getUserConversations);
r.post("/start",auth,startConversation);
export default r;