export const validateId=(req,res,next)=>{
  if(!req.params.userId && !req.params.conversationId)
    return res.status(400).json({error:"Invalid ID"});
  next();
};