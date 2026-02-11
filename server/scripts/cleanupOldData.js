import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Import models
import Notification from '../models/Notification.js';
import GlobalMessage from '../models/GlobalMessage.js';
import SecurityLog from '../models/SecurityLog.js';
import TempMedia from '../models/TempMedia.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Message from '../models/Message.js';
import FollowRequest from '../models/FollowRequest.js';
import GroupChat from '../models/GroupChat.js';

async function cleanupNotifications() {
  console.log('\n🔔 CLEANING UP OLD NOTIFICATIONS...\n');
  
  try {
    // Delete read notifications older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const result = await Notification.deleteMany({
      createdAt: { $lt: ninetyDaysAgo },
      read: true
    });
    
    console.log(`✅ Deleted ${result.deletedCount} old read notifications (>90 days)`);
    
    // Also delete unread notifications older than 180 days (likely abandoned accounts)
    const oneEightyDaysAgo = new Date();
    oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180);
    
    const unreadResult = await Notification.deleteMany({
      createdAt: { $lt: oneEightyDaysAgo },
      read: false
    });
    
    console.log(`✅ Deleted ${unreadResult.deletedCount} old unread notifications (>180 days)`);
    
    // Get current stats
    const totalCount = await Notification.countDocuments();
    const unreadCount = await Notification.countDocuments({ read: false });
    
    console.log(`📊 Remaining notifications: ${totalCount.toLocaleString()}`);
    console.log(`📬 Unread notifications: ${unreadCount.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error cleaning up notifications:', error.message);
  }
}

async function cleanupGlobalMessages() {
  console.log('\n💬 CLEANING UP OLD GLOBAL MESSAGES...\n');
  
  try {
    // Delete messages marked as deleted older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await GlobalMessage.deleteMany({
      isDeleted: true,
      deletedAt: { $lt: thirtyDaysAgo }
    });
    
    console.log(`✅ Deleted ${result.deletedCount} old deleted messages (>30 days)`);
    
    // Get current stats
    const totalCount = await GlobalMessage.countDocuments();
    const deletedCount = await GlobalMessage.countDocuments({ isDeleted: true });
    
    console.log(`📊 Remaining messages: ${totalCount.toLocaleString()}`);
    console.log(`🗑️ Soft-deleted messages: ${deletedCount.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error cleaning up global messages:', error.message);
  }
}

async function cleanupSecurityLogs() {
  console.log('\n🔒 CLEANING UP OLD SECURITY LOGS...\n');
  
  try {
    // Delete security logs older than 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const result = await SecurityLog.deleteMany({
      timestamp: { $lt: oneYearAgo }
    });
    
    console.log(`✅ Deleted ${result.deletedCount} old security logs (>1 year)`);
    
    // Get current stats
    const totalCount = await SecurityLog.countDocuments();
    
    console.log(`📊 Remaining security logs: ${totalCount.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error cleaning up security logs:', error.message);
  }
}

async function cleanupTempMedia() {
  console.log('\n📁 CLEANING UP ORPHANED TEMP MEDIA...\n');
  
  try {
    // Delete temporary media older than 24 hours with no owner
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    const result = await TempMedia.deleteMany({
      status: 'temporary',
      ownerId: null,
      createdAt: { $lt: twentyFourHoursAgo }
    });
    
    console.log(`✅ Deleted ${result.deletedCount} orphaned temp media files (>24 hours)`);
    
    // Get current stats
    const totalCount = await TempMedia.countDocuments();
    const orphanedCount = await TempMedia.countDocuments({ 
      status: 'temporary', 
      ownerId: null 
    });
    
    console.log(`📊 Remaining temp media: ${totalCount.toLocaleString()}`);
    console.log(`🗑️ Orphaned temp media: ${orphanedCount.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error cleaning up temp media:', error.message);
  }
}

async function cleanupDeletedAccounts() {
  console.log('\n🗑️ CLEANING UP PERMANENTLY DELETED ACCOUNTS...\n');

  try {
    // Find accounts that have been soft-deleted for more than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const expiredAccounts = await User.find({
      isDeleted: true,
      deletionScheduledFor: { $lt: thirtyDaysAgo }
    }).select('_id username email');

    if (expiredAccounts.length === 0) {
      console.log('✅ No accounts ready for permanent deletion');
      return;
    }

    console.log(`📋 Found ${expiredAccounts.length} accounts ready for permanent deletion:`);
    expiredAccounts.forEach(account => {
      console.log(`   - ${account.username} (${account._id})`);
    });

    let totalDeleted = 0;

    // Delete each account and all associated data
    for (const account of expiredAccounts) {
      const accountId = account._id;
      console.log(`\n🗑️ Permanently deleting account: ${account.username}`);

      try {
        // Delete all posts by this user
        const postsDeleted = await Post.deleteMany({ author: accountId });
        console.log(`   📝 Deleted ${postsDeleted.deletedCount} posts`);

        // Delete all messages sent/received by this user
        const messagesDeleted = await Message.deleteMany({
          $or: [{ sender: accountId }, { recipient: accountId }]
        });
        console.log(`   💬 Deleted ${messagesDeleted.deletedCount} messages`);

        // Delete all follow requests involving this user
        const followRequestsDeleted = await FollowRequest.deleteMany({
          $or: [{ sender: accountId }, { receiver: accountId }]
        });
        console.log(`   👥 Deleted ${followRequestsDeleted.deletedCount} follow requests`);

        // Remove user from all group chats
        const groupChatsUpdated = await GroupChat.updateMany(
          { members: accountId },
          { $pull: { members: accountId } }
        );
        console.log(`   👥 Removed from ${groupChatsUpdated.modifiedCount} group chats`);

        // Finally, permanently delete the user account
        await User.deleteOne({ _id: accountId });
        console.log(`   ✅ Permanently deleted user account`);

        totalDeleted++;
      } catch (accountError) {
        console.error(`   ❌ Error deleting account ${account.username}:`, accountError.message);
      }
    }

    console.log(`\n✅ Successfully permanently deleted ${totalDeleted} accounts`);

  } catch (error) {
    console.error('❌ Error cleaning up deleted accounts:', error.message);
  }
}

async function generateCleanupReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 CLEANUP REPORT');
  console.log('='.repeat(80) + '\n');

  try {
    // Get final stats for all collections
    const stats = {
      notifications: await Notification.countDocuments(),
      globalMessages: await GlobalMessage.countDocuments(),
      securityLogs: await SecurityLog.countDocuments(),
      tempMedia: await TempMedia.countDocuments(),
      users: await User.countDocuments(),
      posts: await Post.countDocuments(),
      messages: await Message.countDocuments()
    };

    console.log('📊 FINAL COLLECTION SIZES:\n');
    console.log(`   Users: ${stats.users.toLocaleString()}`);
    console.log(`   Posts: ${stats.posts.toLocaleString()}`);
    console.log(`   Messages: ${stats.messages.toLocaleString()}`);
    console.log(`   Notifications: ${stats.notifications.toLocaleString()}`);
    console.log(`   Global Messages: ${stats.globalMessages.toLocaleString()}`);
    console.log(`   Security Logs: ${stats.securityLogs.toLocaleString()}`);
    console.log(`   Temp Media: ${stats.tempMedia.toLocaleString()}`);

    console.log('\n✅ Cleanup complete!\n');
    console.log('💡 TIP: Run this script daily to keep database clean.\n');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error generating cleanup report:', error.message);
  }
}

async function main() {
  try {
    const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
    
    if (!mongoURL) {
      console.error('❌ No MongoDB connection string found in environment variables');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...\n');
    await mongoose.connect(mongoURL);
    console.log('✅ Connected to MongoDB!\n');
    console.log('📍 Database:', mongoose.connection.db.databaseName);
    console.log('='.repeat(80));

    // Run all cleanup tasks
    await cleanupNotifications();
    await cleanupGlobalMessages();
    await cleanupSecurityLogs();
    await cleanupTempMedia();
    await cleanupDeletedAccounts();
    
    // Generate final report
    await generateCleanupReport();
    
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

