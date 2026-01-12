/**
 * Check All Messages in Database
 * 
 * This script checks all messages in the database to see if any exist
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';

dotenv.config();

async function checkAllMessages() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);

    // Count total messages
    const totalMessages = await Message.countDocuments();
    console.log(`\n📊 Total messages in database: ${totalMessages}`);

    if (totalMessages === 0) {
      console.log('❌ No messages found in database!');
      console.log('   This means DMs are NOT being saved.');
      await mongoose.connection.close();
      return;
    }

    // Get recent messages
    console.log('\n📨 Last 20 messages:');
    const recentMessages = await Message.find()
      .populate('sender', 'username displayName')
      .populate('recipient', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(20);

    recentMessages.forEach((msg, i) => {
      const senderName = msg.sender?.displayName || msg.sender?.username || 'Unknown';
      const recipientName = msg.recipient?.displayName || msg.recipient?.username || 'Unknown';
      const preview = msg.content ? msg.content.substring(0, 50) : '[No content]';
      const date = new Date(msg.createdAt).toLocaleString();
      
      console.log(`\n${i + 1}. ${senderName} → ${recipientName}`);
      console.log(`   Content: "${preview}"`);
      console.log(`   Created: ${date}`);
      console.log(`   ID: ${msg._id}`);
      console.log(`   Read: ${msg.read ? 'Yes' : 'No'}`);
    });

    // Group by conversation
    console.log('\n\n📊 Messages by conversation:');
    const conversations = await Message.aggregate([
      {
        $group: {
          _id: {
            user1: { $min: ['$sender', '$recipient'] },
            user2: { $max: ['$sender', '$recipient'] }
          },
          count: { $sum: 1 },
          lastMessage: { $max: '$createdAt' }
        }
      },
      { $sort: { lastMessage: -1 } },
      { $limit: 10 }
    ]);

    for (const conv of conversations) {
      const user1 = await User.findById(conv._id.user1).select('username displayName');
      const user2 = await User.findById(conv._id.user2).select('username displayName');
      
      const user1Name = user1?.displayName || user1?.username || 'Unknown';
      const user2Name = user2?.displayName || user2?.username || 'Unknown';
      const lastDate = new Date(conv.lastMessage).toLocaleString();
      
      console.log(`\n${user1Name} ↔ ${user2Name}`);
      console.log(`   Messages: ${conv.count}`);
      console.log(`   Last message: ${lastDate}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n\n👋 Disconnected from MongoDB');
  }
}

checkAllMessages();

