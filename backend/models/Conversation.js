import mongoose from "mongoose";
const schema=new mongoose.Schema({
  participants:[Number],
  lastMessage:String,
  lastMessageAt:Date,
  isGroup:{type:Boolean,default:false}
},{timestamps:true});
export default mongoose.model("Conversation", schema);