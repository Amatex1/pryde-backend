import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function queryUsers() {
  try {
    const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
    if (!mongoURL) {
      console.error('❌ No MongoDB connection string found in .env');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURL);
    console.log('✅ Connected!\n');

    const users = await mongoose.connection.db.collection('users')
      .find({})
      .project({ username: 1, email: 1, fullName: 1, role: 1, createdAt: 1, isBanned: 1, isDeleted: 1 })
      .sort({ createdAt: 1 })
      .toArray();

    console.log(`📊 Total users: ${users.length}\n`);
    console.log('─'.repeat(90));
    console.log(
      '#'.padEnd(4),
      'Username'.padEnd(22),
      'Email'.padEnd(34),
      'Role'.padEnd(12),
      'Joined'
    );
    console.log('─'.repeat(90));

    users.forEach((user, i) => {
      const flags = [
        user.isBanned  ? '🚫BANNED'  : '',
        user.isDeleted ? '🗑️DELETED' : '',
      ].filter(Boolean).join(' ');

      console.log(
        String(i + 1).padEnd(4),
        (user.username  || 'N/A').padEnd(22),
        (user.email     || 'N/A').padEnd(34),
        (user.role      || 'user').padEnd(12),
        new Date(user.createdAt).toLocaleDateString(),
        flags ? `  ${flags}` : ''
      );
    });

    console.log('─'.repeat(90));
    console.log('\n💡 To delete users run:  node scripts/deleteUsers.js username1 username2 ...');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

queryUsers();

