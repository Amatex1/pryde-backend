import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import FriendRequest from '../models/FriendRequest.js';
import GroupChat from '../models/GroupChat.js';
import Conversation from '../models/Conversation.js';
import Block from '../models/Block.js';
import Report from '../models/Report.js';
import SecurityLog from '../models/SecurityLog.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const checkDatabase = async () => {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('📊 DATABASE HEALTH CHECK\n');
    console.log('=' .repeat(60));

    // Check Users
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const verifiedUsers = await User.countDocuments({ ageVerified: true });
    console.log('\n👥 USERS:');
    console.log(`   Total Users: ${totalUsers}`);
    console.log(`   Active Users: ${activeUsers}`);
    console.log(`   Banned Users: ${bannedUsers}`);
    console.log(`   Age Verified: ${verifiedUsers}`);

    // Check Posts
    const totalPosts = await Post.countDocuments();
    const postsWithComments = await Post.countDocuments({ 'comments.0': { $exists: true } });
    const postsWithMedia = await Post.countDocuments({ 'media.0': { $exists: true } });
    console.log('\n📝 POSTS:');
    console.log(`   Total Posts: ${totalPosts}`);
    console.log(`   Posts with Comments: ${postsWithComments}`);
    console.log(`   Posts with Media: ${postsWithMedia}`);

    // Check Messages
    const totalMessages = await Message.countDocuments();
    const directMessages = await Message.countDocuments({ groupChat: null });
    const groupMessages = await Message.countDocuments({ groupChat: { $ne: null } });
    const unreadMessages = await Message.countDocuments({ read: false });
    console.log('\n💬 MESSAGES:');
    console.log(`   Total Messages: ${totalMessages}`);
    console.log(`   Direct Messages: ${directMessages}`);
    console.log(`   Group Messages: ${groupMessages}`);
    console.log(`   Unread Messages: ${unreadMessages}`);

    // Check for orphaned messages (sender or recipient deleted)
    const orphanedMessages = await Message.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'sender',
          foreignField: '_id',
          as: 'senderUser'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'recipient',
          foreignField: '_id',
          as: 'recipientUser'
        }
      },
      {
        $match: {
          $or: [
            { senderUser: { $size: 0 } },
            { $and: [{ recipient: { $ne: null } }, { recipientUser: { $size: 0 } }] }
          ]
        }
      }
    ]);
    console.log(`   ⚠️  Orphaned Messages: ${orphanedMessages.length}`);

    // Check Notifications
    const totalNotifications = await Notification.countDocuments();
    const unreadNotifications = await Notification.countDocuments({ read: false });
    console.log('\n🔔 NOTIFICATIONS:');
    console.log(`   Total Notifications: ${totalNotifications}`);
    console.log(`   Unread Notifications: ${unreadNotifications}`);

    // Check Friend Requests
    const totalFriendRequests = await FriendRequest.countDocuments();
    const pendingRequests = await FriendRequest.countDocuments({ status: 'pending' });
    const acceptedRequests = await FriendRequest.countDocuments({ status: 'accepted' });
    console.log('\n👋 FRIEND REQUESTS:');
    console.log(`   Total Requests: ${totalFriendRequests}`);
    console.log(`   Pending: ${pendingRequests}`);
    console.log(`   Accepted: ${acceptedRequests}`);

    // Check Group Chats
    const totalGroupChats = await GroupChat.countDocuments();
    console.log('\n👥 GROUP CHATS:');
    console.log(`   Total Group Chats: ${totalGroupChats}`);

    // Check Conversations
    const totalConversations = await Conversation.countDocuments();
    console.log('\n💬 CONVERSATIONS:');
    console.log(`   Total Conversations: ${totalConversations}`);

    // Check Blocks
    const totalBlocks = await Block.countDocuments();
    console.log('\n🚫 BLOCKS:');
    console.log(`   Total Blocks: ${totalBlocks}`);

    // Check Reports
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    console.log('\n🚨 REPORTS:');
    console.log(`   Total Reports: ${totalReports}`);
    console.log(`   Pending Reports: ${pendingReports}`);

    // Check Security Logs
    const totalSecurityLogs = await SecurityLog.countDocuments();
    const unresolvedLogs = await SecurityLog.countDocuments({ resolved: false });
    console.log('\n🔒 SECURITY LOGS:');
    console.log(`   Total Logs: ${totalSecurityLogs}`);
    console.log(`   Unresolved: ${unresolvedLogs}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Database check complete!');

    if (orphanedMessages.length > 0) {
      console.log('\n⚠️  WARNING: Found orphaned messages!');
      console.log('   Run cleanup script to remove them.');
    }

    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  }
};

checkDatabase();

