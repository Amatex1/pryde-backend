/**
 * Test DM Persistence
 *
 * This script tests if DMs are being saved to the database correctly
 * and if the fetch endpoint returns them.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';

dotenv.config();

async function testDMPersistence() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);

    // Get two test users
    const users = await User.find({ role: 'user' }).limit(2).select('_id username displayName');
    
    if (users.length < 2) {
      console.log('❌ Need at least 2 users in database');
      process.exit(1);
    }

    const user1 = users[0];
    const user2 = users[1];

    console.log('\n📊 Test Users:');
    console.log(`User 1: ${user1.displayName || user1.username} (${user1._id})`);
    console.log(`User 2: ${user2.displayName || user2.username} (${user2._id})`);

    // Check existing messages between these users
    console.log('\n🔍 Checking existing messages...');
    const existingMessages = await Message.find({
      $or: [
        { sender: user1._id, recipient: user2._id },
        { sender: user2._id, recipient: user1._id }
      ]
    })
      .populate('sender', 'username displayName')
      .populate('recipient', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(`Found ${existingMessages.length} existing messages`);
    
    if (existingMessages.length > 0) {
      console.log('\n📨 Last 5 messages:');
      existingMessages.slice(0, 5).forEach((msg, i) => {
        const senderName = msg.sender.displayName || msg.sender.username;
        const recipientName = msg.recipient.displayName || msg.recipient.username;
        const preview = msg.content.substring(0, 50);
        console.log(`${i + 1}. ${senderName} → ${recipientName}: "${preview}"`);
        console.log(`   Created: ${msg.createdAt}`);
        console.log(`   ID: ${msg._id}`);
      });
    }

    // Create a test message
    console.log('\n✍️ Creating test message...');
    const testMessage = new Message({
      sender: user1._id,
      recipient: user2._id,
      content: `Test DM from ${user1.username} at ${new Date().toISOString()}`
    });

    await testMessage.save();
    await testMessage.populate([
      { path: 'sender', select: 'username displayName profilePhoto' },
      { path: 'recipient', select: 'username displayName profilePhoto' }
    ]);

    console.log('✅ Test message created:', testMessage._id);

    // Verify it can be fetched
    console.log('\n🔍 Verifying message can be fetched...');
    const fetchedMessages = await Message.find({
      $or: [
        { sender: user1._id, recipient: user2._id },
        { sender: user2._id, recipient: user1._id }
      ]
    })
      .populate('sender', 'username profilePhoto')
      .populate('recipient', 'username profilePhoto')
      .sort({ createdAt: 1 });

    const foundTestMessage = fetchedMessages.find(m => m._id.toString() === testMessage._id.toString());
    
    if (foundTestMessage) {
      console.log('✅ Test message found in fetch results!');
      console.log(`   Total messages in conversation: ${fetchedMessages.length}`);
    } else {
      console.log('❌ Test message NOT found in fetch results!');
    }

    // Clean up test message
    console.log('\n🧹 Cleaning up test message...');
    await Message.findByIdAndDelete(testMessage._id);
    console.log('✅ Test message deleted');

    // Summary
    console.log('\n📊 Summary:');
    console.log(`✅ Database connection: Working`);
    console.log(`✅ Message creation: Working`);
    console.log(`✅ Message fetch: ${foundTestMessage ? 'Working' : 'FAILED'}`);
    console.log(`✅ Total messages between users: ${existingMessages.length}`);

    // Test the API endpoint query
    console.log('\n🔍 Testing API endpoint query...');
    const apiQueryResult = await Message.find({
      $or: [
        { sender: user1._id, recipient: user2._id },
        { sender: user2._id, recipient: user1._id }
      ],
      'deletedFor.user': { $ne: user1._id }
    })
      .populate('sender', 'username profilePhoto')
      .populate('recipient', 'username profilePhoto')
      .sort({ createdAt: 1 });

    console.log(`✅ API query returned ${apiQueryResult.length} messages`);

    if (apiQueryResult.length !== existingMessages.length) {
      console.log(`⚠️ Warning: API query returned different count than basic query`);
      console.log(`   Basic query: ${existingMessages.length}`);
      console.log(`   API query: ${apiQueryResult.length}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

testDMPersistence();

