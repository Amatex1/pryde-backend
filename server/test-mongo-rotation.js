const mongoose = require('mongoose');
const NEW_MONGO_URI = process.env.NEW_MONGO_URI || 'paste_new_uri_here';

async function test() {
  try {
    await mongoose.connect(NEW_MONGO_URI);
    const User = require('./models/User');
    const count = await User.countDocuments();
    console.log(`✅ New connection OK: ${count} users`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Connection failed:', e.message);
    process.exit(1);
  }
}

test();
