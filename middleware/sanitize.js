import sanitizeHtml from "sanitize-html";
export const sanitizeInput=(req,res,next)=>{
  if(req.body.text) req.body.text=sanitizeHtml(req.body.text);
  next();
};