import mongoose from 'mongoose';
const NEW_MONGO_URI = process.env.NEW_MONGO_URI || 'mongodb://localhost:27017/pryde-social';

async function test() {
  try {
    await mongoose.connect(NEW_MONGO_URI);
    const User = (await import('./models/User.js')).default;
    const count = await User.countDocuments();
    console.log(`✅ New connection OK: ${count} users`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Connection failed:', e.message);
    process.exit(1);
  }
}
test();
