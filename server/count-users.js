import mongoose from 'mongoose';
import config from './config/config.js';
import User from './models/User.js';

async function countUsers() {
  try {
    await mongoose.connect(config.mongoURI);
    const count = await User.countDocuments({ isDeleted: false });
    console.log(`Active users: ${count}`);
    const total = await User.estimatedDocumentCount();
    console.log(`Total users (incl deleted): ${total}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

countUsers();

