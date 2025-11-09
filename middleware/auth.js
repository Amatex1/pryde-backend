export const auth=(req,res,next)=>{
  const user=req.headers["x-wp-user"];
  if(!user) return res.status(403).json({error:"Not authenticated"});
  req.userId=parseInt(user);
  next();
};