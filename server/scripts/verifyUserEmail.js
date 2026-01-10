import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function verifyUserEmail(usernameOrEmail) {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: usernameOrEmail.toLowerCase() },
        { email: usernameOrEmail.toLowerCase() }
      ]
    });

    if (!user) {
      console.log('❌ User not found:', usernameOrEmail);
      process.exit(1);
    }

    if (user.emailVerified) {
      console.log('✅ Email already verified for:', user.username);
      console.log('   Email:', user.email);
      process.exit(0);
    }

    // Verify the email
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    console.log('✅ Email verified successfully!');
    console.log('   Username:', user.username);
    console.log('   Email:', user.email);
    console.log('   You can now create posts!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get username/email from command line
const usernameOrEmail = process.argv[2];

if (!usernameOrEmail) {
  console.log('Usage: node verifyUserEmail.js <username or email>');
  process.exit(1);
}

verifyUserEmail(usernameOrEmail);

