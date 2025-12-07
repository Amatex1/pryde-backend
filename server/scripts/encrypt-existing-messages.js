/**
 * Migration Script: Encrypt Existing Messages
 * 
 * This script encrypts all existing plain-text messages in the database.
 * Run this ONCE after implementing message encryption.
 * 
 * Usage:
 *   node server/scripts/encrypt-existing-messages.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { encryptMessage, isEncrypted } from '../utils/encryption.js';
import Message from '../models/Message.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URL;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI or MONGO_URL not found in environment variables');
    }
    
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Encrypt all existing messages
const encryptExistingMessages = async () => {
  try {
    console.log('\n🔍 Finding messages to encrypt...');
    
    // Find all messages
    const messages = await Message.find({}).select('_id content');
    
    console.log(`📊 Found ${messages.length} total messages`);
    
    let encryptedCount = 0;
    let alreadyEncryptedCount = 0;
    let errorCount = 0;
    
    // Process messages in batches
    const batchSize = 100;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(messages.length / batchSize)}...`);
      
      for (const message of batch) {
        try {
          // Check if already encrypted
          if (isEncrypted(message.content)) {
            alreadyEncryptedCount++;
            continue;
          }
          
          // Encrypt the content
          const encryptedContent = encryptMessage(message.content);
          
          // Update directly in database (bypass middleware)
          await Message.updateOne(
            { _id: message._id },
            { $set: { content: encryptedContent } }
          );
          
          encryptedCount++;
          
          if (encryptedCount % 10 === 0) {
            process.stdout.write(`\r🔒 Encrypted: ${encryptedCount} | Already encrypted: ${alreadyEncryptedCount} | Errors: ${errorCount}`);
          }
        } catch (error) {
          console.error(`\n❌ Error encrypting message ${message._id}:`, error.message);
          errorCount++;
        }
      }
    }
    
    console.log('\n\n✅ Migration complete!');
    console.log(`📊 Summary:`);
    console.log(`   - Total messages: ${messages.length}`);
    console.log(`   - Newly encrypted: ${encryptedCount}`);
    console.log(`   - Already encrypted: ${alreadyEncryptedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log('\n⚠️ Some messages failed to encrypt. Check the errors above.');
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    console.log('🔐 Message Encryption Migration');
    console.log('================================\n');
    
    // Check for encryption key
    if (!process.env.MESSAGE_ENCRYPTION_KEY) {
      console.error('❌ ERROR: MESSAGE_ENCRYPTION_KEY not found in environment variables!');
      console.log('\n📝 To fix this:');
      console.log('1. Generate a key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      console.log('2. Add to .env: MESSAGE_ENCRYPTION_KEY=<your-generated-key>');
      process.exit(1);
    }
    
    console.log('✅ Encryption key found');
    
    // Connect to database
    await connectDB();
    
    // Run migration
    await encryptExistingMessages();
    
    // Disconnect
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the script
main();

