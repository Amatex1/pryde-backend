import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function queryUsers() {
  try {
    const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
    
    if (!mongoURL) {
      console.error('❌ No MongoDB connection string found');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURL);
    console.log('✅ Connected!\n');

    // Run the query: db.users.countDocuments({})
    const count = await mongoose.connection.db.collection('users').countDocuments({});
    
    console.log('📊 Query Result:');
    console.log('   db.users.countDocuments({})');
    console.log(`   → ${count} users\n`);

    // Also get some sample user data (without passwords)
    const sampleUsers = await mongoose.connection.db.collection('users')
      .find({})
      .project({ username: 1, email: 1, createdAt: 1, role: 1 })
      .limit(5)
      .toArray();

    if (sampleUsers.length > 0) {
      console.log('👥 Sample Users:');
      sampleUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.username || 'N/A'} (${user.email || 'N/A'}) - Role: ${user.role || 'user'}`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Query completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

queryUsers();

