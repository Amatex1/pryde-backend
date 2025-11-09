import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
export const getMessages=async(req,res)=>{
  try{
    const {conversationId}=req.params;
    const convo=await Conversation.findById(conversationId);
    if(!convo) return res.status(404).json({error:"Not found"});
    if(!convo.participants.includes(req.userId)) return res.status(403).json({error:"Forbidden"});
    const msgs=await Message.find({conversationId}).sort({createdAt:1});
    res.json(msgs);
  }catch(e){res.status(500).json({error:e.message});}
};
export const sendMessage=async(req,res)=>{
  try{
    const {conversationId,text}=req.body;
    const convo=await Conversation.findById(conversationId);
    if(!convo) return res.status(404).json({error:"Not found"});
    if(!convo.participants.includes(req.userId)) return res.status(403).json({error:"Forbidden"});
    const msg=await Message.create({conversationId,senderId:req.userId,text,readBy:[req.userId]});
    convo.lastMessage=text;
    convo.lastMessageAt=new Date();
    await convo.save();
    res.json(msg);
  }catch(e){res.status(500).json({error:e.message});}
};