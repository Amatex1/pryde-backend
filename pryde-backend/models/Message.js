import mongoose from "mongoose";
const schema=new mongoose.Schema({
  conversationId:{type:mongoose.Schema.Types.ObjectId,ref:"Conversation"},
  senderId:Number,
  text:String,
  readBy:[Number]
},{timestamps:true});
export default mongoose.model("Message", schema);