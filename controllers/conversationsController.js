import Conversation from "../models/Conversation.js";
export const getUserConversations=async(req,res)=>{
  try{
    const userId=parseInt(req.params.userId);
    if(userId!==req.userId) return res.status(403).json({error:"Forbidden"});
    const convos=await Conversation.find({participants:userId}).sort({lastMessageAt:-1});
    res.json(convos);
  }catch(e){res.status(500).json({error:e.message});}
};
export const startConversation=async(req,res)=>{
  try{
    const {userId,targetId}=req.body;
    if(userId!==req.userId) return res.status(403).json({error:"Forbidden"});
    const convo=await Conversation.create({participants:[userId,targetId]});
    res.json(convo);
  }catch(e){res.status(500).json({error:e.message});}
};