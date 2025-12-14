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
import logger from '../utils/logger.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const checkDatabase = async () => {
  try {
    logger.debug('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    logger.debug('✅ Connected to MongoDB\n');

    logger.debug('📊 DATABASE HEALTH CHECK\n');
    logger.debug('=' .repeat(60));

    // Check Users
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const verifiedUsers = await User.countDocuments({ ageVerified: true });
    logger.debug('\n👥 USERS:');
    logger.debug(`   Total Users: ${totalUsers}`);
    logger.debug(`   Active Users: ${activeUsers}`);
    logger.debug(`   Banned Users: ${bannedUsers}`);
    logger.debug(`   Age Verified: ${verifiedUsers}`);

    // Check Posts
    const totalPosts = await Post.countDocuments();
    const postsWithComments = await Post.countDocuments({ 'comments.0': { $exists: true } });
    const postsWithMedia = await Post.countDocuments({ 'media.0': { $exists: true } });
    logger.debug('\n📝 POSTS:');
    logger.debug(`   Total Posts: ${totalPosts}`);
    logger.debug(`   Posts with Comments: ${postsWithComments}`);
    logger.debug(`   Posts with Media: ${postsWithMedia}`);

    // Check Messages
    const totalMessages = await Message.countDocuments();
    const directMessages = await Message.countDocuments({ groupChat: null });
    const groupMessages = await Message.countDocuments({ groupChat: { $ne: null } });
    const unreadMessages = await Message.countDocuments({ read: false });
    logger.debug('\n💬 MESSAGES:');
    logger.debug(`   Total Messages: ${totalMessages}`);
    logger.debug(`   Direct Messages: ${directMessages}`);
    logger.debug(`   Group Messages: ${groupMessages}`);
    logger.debug(`   Unread Messages: ${unreadMessages}`);

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
    logger.debug(`   ⚠️  Orphaned Messages: ${orphanedMessages.length}`);

    // Check Notifications
    const totalNotifications = await Notification.countDocuments();
    const unreadNotifications = await Notification.countDocuments({ read: false });
    logger.debug('\n🔔 NOTIFICATIONS:');
    logger.debug(`   Total Notifications: ${totalNotifications}`);
    logger.debug(`   Unread Notifications: ${unreadNotifications}`);

    // Check Friend Requests
    const totalFriendRequests = await FriendRequest.countDocuments();
    const pendingRequests = await FriendRequest.countDocuments({ status: 'pending' });
    const acceptedRequests = await FriendRequest.countDocuments({ status: 'accepted' });
    logger.debug('\n👋 FRIEND REQUESTS:');
    logger.debug(`   Total Requests: ${totalFriendRequests}`);
    logger.debug(`   Pending: ${pendingRequests}`);
    logger.debug(`   Accepted: ${acceptedRequests}`);

    // Check Group Chats
    const totalGroupChats = await GroupChat.countDocuments();
    logger.debug('\n👥 GROUP CHATS:');
    logger.debug(`   Total Group Chats: ${totalGroupChats}`);

    // Check Conversations
    const totalConversations = await Conversation.countDocuments();
    logger.debug('\n💬 CONVERSATIONS:');
    logger.debug(`   Total Conversations: ${totalConversations}`);

    // Check Blocks
    const totalBlocks = await Block.countDocuments();
    logger.debug('\n🚫 BLOCKS:');
    logger.debug(`   Total Blocks: ${totalBlocks}`);

    // Check Reports
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    logger.debug('\n🚨 REPORTS:');
    logger.debug(`   Total Reports: ${totalReports}`);
    logger.debug(`   Pending Reports: ${pendingReports}`);

    // Check Security Logs
    const totalSecurityLogs = await SecurityLog.countDocuments();
    const unresolvedLogs = await SecurityLog.countDocuments({ resolved: false });
    logger.debug('\n🔒 SECURITY LOGS:');
    logger.debug(`   Total Logs: ${totalSecurityLogs}`);
    logger.debug(`   Unresolved: ${unresolvedLogs}`);

    logger.debug('\n' + '='.repeat(60));
    logger.debug('\n✅ Database check complete!');

    if (orphanedMessages.length > 0) {
      logger.debug('\n⚠️  WARNING: Found orphaned messages!');
      logger.debug('   Run cleanup script to remove them.');
    }

    await mongoose.connection.close();
    logger.debug('\n🔌 Disconnected from MongoDB');
  } catch (error) {
    logger.error('❌ Error checking database:', error);
    process.exit(1);
  }
};

checkDatabase();

