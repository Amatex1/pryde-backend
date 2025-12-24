/**
 * Test MongoDB Connection
 * Simple script to test if MongoDB connection works
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// 🔍 DEBUG: Inspect Mongo URI exactly as Node sees it
console.log(
  'MONGO_URI RAW:',
  JSON.stringify(process.env.MONGO_URI)
);
async function testConnection() {
  console.log('🧪 Testing MongoDB Connection...\n');

  // Check for MongoDB URL
  const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
  
  if (!mongoURL) {
    console.error('❌ No MongoDB connection string found!');
    console.error('   Please set one of these in your .env file:');
    console.error('   - MONGO_URI');
    console.error('   - MONGO_URL');
    console.error('   - MONGODB_URI');
    process.exit(1);
  }

  console.log('📋 Environment Variables:');
  console.log(`   MONGO_URI: ${process.env.MONGO_URI ? '✓ Set' : '✗ Not set'}`);
  console.log(`   MONGO_URL: ${process.env.MONGO_URL ? '✓ Set' : '✗ Not set'}`);
  console.log(`   MONGODB_URI: ${process.env.MONGODB_URI ? '✓ Set' : '✗ Not set'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log();

  console.log('🔗 Connection String:');
  // Mask password in connection string
  const maskedURL = mongoURL.replace(/:([^:@]+)@/, ':****@');
  console.log(`   ${maskedURL}`);
  console.log();

  console.log('📡 Attempting to connect...');

  // Try different authSource options
  const urlsToTry = [
    mongoURL,
    mongoURL.replace('authSource=admin', 'authSource=pryde'),
    mongoURL.includes('authSource') ? mongoURL.split('&authSource')[0].split('?authSource')[0] : mongoURL,
  ];

  let connected = false;
  let lastError = null;

  for (let i = 0; i < urlsToTry.length; i++) {
    const testURL = urlsToTry[i];
    const maskedTestURL = testURL.replace(/:([^:@]+)@/, ':****@');

    console.log(`\n   Attempt ${i + 1}/${urlsToTry.length}: ${maskedTestURL.substring(0, 80)}...`);

    try {
      await mongoose.connect(testURL, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });

      console.log('   ✅ Success!');
      connected = true;
      break;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      lastError = error;

      // Disconnect before trying next URL
      try {
        await mongoose.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
  }

  if (!connected) {
    console.error('\n❌ All connection attempts failed!');
    console.error();
    console.error('Error details:');
    console.error(`   Type: ${lastError.name}`);
    console.error(`   Message: ${lastError.message}`);

    if (lastError.code) {
      console.error(`   Code: ${lastError.code}`);
    }

    if (lastError.codeName) {
      console.error(`   Code Name: ${lastError.codeName}`);
    }

    console.error();
    console.error('💡 Troubleshooting:');

    if (lastError.message.includes('auth')) {
      console.error('   1. Check your MongoDB username and password');
      console.error('   2. Verify the database name in the connection string');
      console.error('   3. Make sure the user has permissions for this database');
    }

    if (lastError.message.includes('ENOTFOUND') || lastError.message.includes('timeout')) {
      console.error('   1. Check your internet connection');
      console.error('   2. Verify the MongoDB cluster URL is correct');
      console.error('   3. Make sure your IP is whitelisted in MongoDB Atlas');
    }

    console.error();
    console.error('📖 See server/audit/TROUBLESHOOTING.md for more help');

    process.exit(1);
  }

  // If connected, show database info
  console.log();

  // Get database info
  const db = mongoose.connection.db;
  const admin = db.admin();

  try {
    const serverInfo = await admin.serverInfo();
    console.log('📊 Server Info:');
    console.log(`   MongoDB Version: ${serverInfo.version}`);
    console.log(`   Database: ${db.databaseName}`);
    console.log();
  } catch (infoError) {
    console.log('⚠️  Could not get server info (this is okay)');
    console.log();
  }

  // List collections
  try {
    const collections = await db.listCollections().toArray();
    console.log(`📚 Collections (${collections.length}):`);
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    console.log();
  } catch (collError) {
    console.log('⚠️  Could not list collections (this is okay)');
    console.log();
  }

  // Count some documents
  try {
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const userCount = await User.countDocuments();
    console.log(`👥 User Count: ${userCount}`);
    console.log();
  } catch (countError) {
    console.log('⚠️  Could not count users (this is okay)');
    console.log();
  }

  console.log('🎉 Connection test successful!');
  console.log('   You can now run: npm run audit');

  await mongoose.disconnect();
  process.exit(0);
}

testConnection();

