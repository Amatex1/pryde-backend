/**
 * Message Persistence Tests
 * Tests to verify messages are saved to database and retrieved correctly
 */

import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Message from '../models/Message.js';
import User from '../models/User.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

describe('Message Persistence Tests', function() {
  this.timeout(10000);

  let testUser1, testUser2;

  before(async function() {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      const testDbUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://localhost:27017/pryde-test';
      await mongoose.connect(testDbUri);
    }

    // Create test users
    testUser1 = await User.create({
      username: `testuser1_${Date.now()}`,
      email: `test1_${Date.now()}@example.com`,
      password: 'TestPassword123!',
      emailVerified: true
    });

    testUser2 = await User.create({
      username: `testuser2_${Date.now()}`,
      email: `test2_${Date.now()}@example.com`,
      password: 'TestPassword123!',
      emailVerified: true
    });
  });

  after(async function() {
    // Cleanup test data
    if (testUser1) await User.deleteOne({ _id: testUser1._id });
    if (testUser2) await User.deleteOne({ _id: testUser2._id });
    await Message.deleteMany({
      $or: [
        { sender: testUser1?._id },
        { sender: testUser2?._id }
      ]
    });
  });

  describe('Message Creation', function() {
    it('should save a message to the database', async function() {
      const message = await Message.create({
        sender: testUser1._id,
        recipient: testUser2._id,
        content: 'Test message content',
        read: false
      });

      expect(message).to.exist;
      expect(message._id).to.exist;
      expect(message.sender.toString()).to.equal(testUser1._id.toString());
      expect(message.recipient.toString()).to.equal(testUser2._id.toString());
      expect(message.content).to.equal('Test message content');
      expect(message.createdAt).to.exist;
    });

    it('should save message with attachment', async function() {
      const message = await Message.create({
        sender: testUser1._id,
        recipient: testUser2._id,
        content: 'Message with attachment',
        attachment: 'https://example.com/image.jpg',
        read: false
      });

      expect(message.attachment).to.equal('https://example.com/image.jpg');
    });
  });

  describe('Message Retrieval', function() {
    let savedMessage;

    before(async function() {
      // Create a test message
      savedMessage = await Message.create({
        sender: testUser1._id,
        recipient: testUser2._id,
        content: 'Retrieval test message',
        read: false
      });
    });

    it('should retrieve messages between two users', async function() {
      const messages = await Message.find({
        $or: [
          { sender: testUser1._id, recipient: testUser2._id },
          { sender: testUser2._id, recipient: testUser1._id }
        ]
      }).sort({ createdAt: 1 });

      expect(messages).to.be.an('array');
      expect(messages.length).to.be.at.least(1);
      
      const found = messages.find(m => m._id.toString() === savedMessage._id.toString());
      expect(found).to.exist;
      expect(found.content).to.equal('Retrieval test message');
    });

    it('should populate sender and recipient information', async function() {
      const messages = await Message.find({
        sender: testUser1._id,
        recipient: testUser2._id
      })
        .populate('sender', 'username')
        .populate('recipient', 'username');

      expect(messages[0].sender.username).to.equal(testUser1.username);
      expect(messages[0].recipient.username).to.equal(testUser2.username);
    });
  });

  describe('Message Read Status', function() {
    it('should update read status', async function() {
      const message = await Message.create({
        sender: testUser1._id,
        recipient: testUser2._id,
        content: 'Read status test',
        read: false
      });

      expect(message.read).to.be.false;

      message.read = true;
      await message.save();

      const updated = await Message.findById(message._id);
      expect(updated.read).to.be.true;
    });
  });
});

