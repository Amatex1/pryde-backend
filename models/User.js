import mongoose from "mongoose";
const userSchema=new mongoose.Schema({
  wpUserId:{type:Number,required:true,unique:true},
  username:String,
  avatar:String
},{timestamps:true});
export default mongoose.model("User", userSchema);