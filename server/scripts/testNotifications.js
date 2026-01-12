/**
 * Test Notification Script
 * Sends test notifications to all users or specific users to verify the notification system
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// Load environment variables
dotenv.config();

// Support MONGO_URI, MONGO_URL and MONGODB_URI for flexibility (same as dbConn.js)
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGO_URI is missing in environment variables');
  process.exit(1);
}

/**
 * Create a test notification for a user
 */
async function createTestNotification(userId, testType = 'system') {
  try {
    const notification = new Notification({
      recipient: userId,
      sender: userId, // Self-notification for testing
      type: testType,
      message: `🧪 Test notification - ${new Date().toLocaleString()}`,
      read: false,
      createdAt: new Date()
    });

    await notification.save();
    console.log(`✅ Created test notification for user: ${userId}`);
    return notification;
  } catch (error) {
    console.error(`❌ Failed to create notification for user ${userId}:`, error.message);
    return null;
  }
}

/**
 * Send test notifications to all users
 */
async function sendTestNotificationsToAll() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all users
    const users = await User.find({}).select('_id username email');
    console.log(`📊 Found ${users.length} users`);

    if (users.length === 0) {
      console.log('⚠️ No users found in database');
      return;
    }

    // Create test notifications for each user
    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      const notification = await createTestNotification(user._id, 'system');
      if (notification) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Successfully created: ${successCount} notifications`);
    console.log(`❌ Failed: ${failCount} notifications`);
    console.log(`📬 Total users: ${users.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

/**
 * Send test notification to a specific user
 */
async function sendTestNotificationToUser(username) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find user by username
    const user = await User.findOne({ username }).select('_id username email');
    
    if (!user) {
      console.log(`❌ User not found: ${username}`);
      return;
    }

    console.log(`📧 Found user: ${user.username} (${user.email})`);

    // Create test notification
    const notification = await createTestNotification(user._id, 'system');
    
    if (notification) {
      console.log('✅ Test notification created successfully!');
      console.log(`📬 Notification ID: ${notification._id}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const username = args[1];

if (command === 'all') {
  console.log('🚀 Sending test notifications to ALL users...\n');
  sendTestNotificationsToAll();
} else if (command === 'user' && username) {
  console.log(`🚀 Sending test notification to user: ${username}\n`);
  sendTestNotificationToUser(username);
} else {
  console.log('📖 Usage:');
  console.log('  node server/scripts/testNotifications.js all           - Send to all users');
  console.log('  node server/scripts/testNotifications.js user <username> - Send to specific user');
  console.log('\nExamples:');
  console.log('  node server/scripts/testNotifications.js all');
  console.log('  node server/scripts/testNotifications.js user johndoe');
}

