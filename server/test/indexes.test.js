/**
 * Database Index Tests
 * Verify that all required indexes exist on MongoDB collections
 */

import { describe, it, before, after } from 'mocha';
import { strict as assert } from 'assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Import models
import Post from '../models/Post.js';
import Message from '../models/Message.js';
import FriendRequest from '../models/FriendRequest.js';
import GroupChat from '../models/GroupChat.js';
import Conversation from '../models/Conversation.js';
import Journal from '../models/Journal.js';
import PhotoEssay from '../models/PhotoEssay.js';
import Event from '../models/Event.js';

describe('Database Index Tests', function() {
  this.timeout(10000);
  
  before(async function() {
    const testDbUri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI;
    await mongoose.connect(testDbUri);
  });
  
  after(async function() {
    await mongoose.connection.close();
  });
  
  /**
   * Helper function to check if an index exists
   */
  async function hasIndex(model, indexName) {
    const indexes = await model.collection.getIndexes();
    return Object.keys(indexes).includes(indexName);
  }
  
  describe('Post Model Indexes', function() {
    it('should have visibility + createdAt index', async function() {
      const exists = await hasIndex(Post, 'visibility_1_createdAt_-1');
      assert.ok(exists, 'visibility_1_createdAt_-1 index is missing');
    });
    
    it('should have hashtags index', async function() {
      const exists = await hasIndex(Post, 'hashtags_1');
      assert.ok(exists, 'hashtags_1 index is missing');
    });
    
    it('should have tags index', async function() {
      const exists = await hasIndex(Post, 'tags_1');
      assert.ok(exists, 'tags_1 index is missing');
    });
  });
  
  describe('Message Model Indexes', function() {
    it('should have groupChat + createdAt index', async function() {
      const exists = await hasIndex(Message, 'groupChat_1_createdAt_-1');
      assert.ok(exists, 'groupChat_1_createdAt_-1 index is missing');
    });
    
    it('should have sender + createdAt index', async function() {
      const exists = await hasIndex(Message, 'sender_1_createdAt_-1');
      assert.ok(exists, 'sender_1_createdAt_-1 index is missing');
    });
    
    it('should have recipient + createdAt index', async function() {
      const exists = await hasIndex(Message, 'recipient_1_createdAt_-1');
      assert.ok(exists, 'recipient_1_createdAt_-1 index is missing');
    });
  });
  
  describe('FriendRequest Model Indexes', function() {
    it('should have receiver + status index', async function() {
      const exists = await hasIndex(FriendRequest, 'receiver_1_status_1');
      assert.ok(exists, 'receiver_1_status_1 index is missing');
    });
    
    it('should have status + createdAt index', async function() {
      const exists = await hasIndex(FriendRequest, 'status_1_createdAt_-1');
      assert.ok(exists, 'status_1_createdAt_-1 index is missing');
    });
  });
  
  describe('GroupChat Model Indexes', function() {
    it('should have members index', async function() {
      const exists = await hasIndex(GroupChat, 'members_1');
      assert.ok(exists, 'members_1 index is missing');
    });
    
    it('should have updatedAt index', async function() {
      const exists = await hasIndex(GroupChat, 'updatedAt_-1');
      assert.ok(exists, 'updatedAt_-1 index is missing');
    });
  });
  
  describe('Conversation Model Indexes', function() {
    it('should have participants index', async function() {
      const exists = await hasIndex(Conversation, 'participants_1');
      assert.ok(exists, 'participants_1 index is missing');
    });
    
    it('should have updatedAt index', async function() {
      const exists = await hasIndex(Conversation, 'updatedAt_-1');
      assert.ok(exists, 'updatedAt_-1 index is missing');
    });
  });
  
  describe('Journal Model Indexes', function() {
    it('should have user + createdAt index', async function() {
      const exists = await hasIndex(Journal, 'user_1_createdAt_-1');
      assert.ok(exists, 'user_1_createdAt_-1 index is missing');
    });
    
    it('should have tags index', async function() {
      const exists = await hasIndex(Journal, 'tags_1');
      assert.ok(exists, 'tags_1 index is missing');
    });
  });
  
  describe('PhotoEssay Model Indexes', function() {
    it('should have user + createdAt index', async function() {
      const exists = await hasIndex(PhotoEssay, 'user_1_createdAt_-1');
      assert.ok(exists, 'user_1_createdAt_-1 index is missing');
    });
    
    it('should have tags index', async function() {
      const exists = await hasIndex(PhotoEssay, 'tags_1');
      assert.ok(exists, 'tags_1 index is missing');
    });
  });
  
  describe('Event Model Indexes', function() {
    it('should have startDate + category index', async function() {
      const exists = await hasIndex(Event, 'startDate_1_category_1');
      assert.ok(exists, 'startDate_1_category_1 index is missing');
    });
    
    it('should have isPrivate + startDate index', async function() {
      const exists = await hasIndex(Event, 'isPrivate_1_startDate_1');
      assert.ok(exists, 'isPrivate_1_startDate_1 index is missing');
    });
  });
});

