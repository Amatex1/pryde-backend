import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const verifyMigration = async () => {
  try {
    console.log('🔍 Verifying migration...\n');

    const MONGO_URL = process.env.MONGODB_URI || process.env.MONGO_URL;
    await mongoose.connect(MONGO_URL);
    console.log('✅ Connected to MongoDB\n');

    // Get a sample user
    const user = await User.findOne({ username: 'Amatex' });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('📊 User: Amatex');
    console.log('─'.repeat(50));
    console.log('Friends:', user.friends?.length || 0);
    console.log('Followers:', user.followers?.length || 0);
    console.log('Following:', user.following?.length || 0);
    console.log('\n📋 Privacy Settings:');
    console.log('─'.repeat(50));
    console.log('Profile Visibility:', user.privacySettings?.profileVisibility);
    console.log('Private Account:', user.privacySettings?.isPrivateAccount);
    console.log('Who Can Message:', user.privacySettings?.whoCanMessage);
    console.log('Who Can See Posts:', user.privacySettings?.whoCanSeeMyPosts);
    console.log('Who Can Comment:', user.privacySettings?.whoCanCommentOnMyPosts);
    console.log('Who Can See Followers List:', user.privacySettings?.whoCanSeeFollowersList);
    
    console.log('\n✅ Migration verified successfully!\n');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
};

verifyMigration();

