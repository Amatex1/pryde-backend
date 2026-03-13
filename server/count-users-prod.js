import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://prydeAdmin:PhWou3shhtBBATuy@pryde-social.bvs3dyu.mongodb.net/pryde-social?retryWrites=true&w=majority&authSource=admin';

async function countUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false })); // Dynamic schema
    const active = await User.countDocuments({ isDeleted: false, isActive: true });
    const total = await User.estimatedDocumentCount();
    const recent = await User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 30*24*60*60*1000) } });
    console.log(`Active users (isDeleted:false, isActive:true): ${active}`);
    console.log(`Total users: ${total}`);
    console.log(`Users active last 30 days: ${recent}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

countUsers();

