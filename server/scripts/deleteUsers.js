/**
 * deleteUsers.js — Hard-delete one or more users by username.
 *
 * Usage (dry-run first, no changes made):
 *   node scripts/deleteUsers.js testuser1 testuser2
 *
 * To actually delete:
 *   node scripts/deleteUsers.js testuser1 testuser2 --confirm
 *
 * What gets removed per user:
 *   - User document
 *   - Their posts, comments, sessions, reports filed BY them
 *   - Removed from other users' followers / following arrays
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const usernames = args.filter(a => a !== '--confirm');

if (usernames.length === 0) {
  console.error('❌ Provide at least one username.\n   node scripts/deleteUsers.js username1 username2 --confirm');
  process.exit(1);
}

async function deleteUsers() {
  try {
    const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
    if (!mongoURL) {
      console.error('❌ No MongoDB connection string found in .env');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURL);
    console.log('✅ Connected!\n');

    const db = mongoose.connection.db;

    for (const username of usernames) {
      const user = await db.collection('users').findOne(
        { username },
        { projection: { _id: 1, username: 1, email: 1, role: 1 } }
      );

      if (!user) {
        console.log(`⚠️  User not found: "${username}" — skipping`);
        continue;
      }

      // Safety: never delete admins/super_admins via this script
      if (user.role === 'admin' || user.role === 'super_admin') {
        console.log(`🛡️  Skipping "${username}" — role is ${user.role} (protected)`);
        continue;
      }

      console.log(`\n👤 ${username} (${user.email})  id: ${user._id}`);

      const userId = user._id;

      // Count related documents to show the user what will be removed
      const [posts, comments, sessions, reports] = await Promise.all([
        db.collection('posts').countDocuments({ author: userId }),
        db.collection('comments').countDocuments({ author: userId }),
        db.collection('sessions').countDocuments({ userId }),
        db.collection('reports').countDocuments({ reporter: userId }),
      ]);

      console.log(`   Posts: ${posts}  Comments: ${comments}  Sessions: ${sessions}  Reports filed: ${reports}`);

      if (!confirm) {
        console.log('   ⏭️  DRY RUN — no changes made (add --confirm to delete)');
        continue;
      }

      // Perform deletions
      await Promise.all([
        db.collection('users').deleteOne({ _id: userId }),
        db.collection('posts').deleteMany({ author: userId }),
        db.collection('comments').deleteMany({ author: userId }),
        db.collection('sessions').deleteMany({ userId }),
        db.collection('reports').deleteMany({ reporter: userId }),
        // Remove from other users' social arrays
        db.collection('users').updateMany(
          { $or: [{ followers: userId }, { following: userId }, { friends: userId }] },
          { $pull: { followers: userId, following: userId, friends: userId } }
        ),
      ]);

      console.log(`   ✅ Deleted "${username}" and all related data`);
    }

    if (!confirm) {
      console.log('\n💡 Re-run with --confirm to permanently delete the above users.');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteUsers();

