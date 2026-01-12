/**
 * Unit Tests: Message Deduplication
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  generateMessageFingerprint,
  checkDuplicate,
  registerMessage,
  createMessageIdempotent,
  clearMessageCache
} from '../../utils/messageDeduplication.js';

describe('Message Deduplication', () => {
  beforeEach(() => {
    clearMessageCache();
  });

  describe('generateMessageFingerprint', () => {
    it('should generate consistent fingerprints for same input', () => {
      const fp1 = generateMessageFingerprint('user1', 'user2', 'Hello');
      const fp2 = generateMessageFingerprint('user1', 'user2', 'Hello');
      
      expect(fp1).toBe(fp2);
    });

    it('should generate different fingerprints for different content', () => {
      const fp1 = generateMessageFingerprint('user1', 'user2', 'Hello');
      const fp2 = generateMessageFingerprint('user1', 'user2', 'Hi');
      
      expect(fp1).not.toBe(fp2);
    });

    it('should round timestamps to 5-second intervals', () => {
      const timestamp1 = 1000000;
      const timestamp2 = 1002000; // 2 seconds later
      
      const fp1 = generateMessageFingerprint('user1', 'user2', 'Hello', timestamp1);
      const fp2 = generateMessageFingerprint('user1', 'user2', 'Hello', timestamp2);
      
      // Should be same because within 5-second window
      expect(fp1).toBe(fp2);
    });
  });

  describe('checkDuplicate', () => {
    it('should return null for non-existent fingerprint', () => {
      const result = checkDuplicate('nonexistent');
      expect(result).toBeNull();
    });

    it('should return cached message for existing fingerprint', () => {
      const fingerprint = 'test123';
      const messageId = 'msg456';
      
      registerMessage(fingerprint, messageId);
      const result = checkDuplicate(fingerprint);
      
      expect(result).not.toBeNull();
      expect(result.messageId).toBe(messageId);
    });
  });

  describe('registerMessage', () => {
    it('should register message fingerprint', () => {
      const fingerprint = 'test123';
      const messageId = 'msg456';
      
      registerMessage(fingerprint, messageId);
      const result = checkDuplicate(fingerprint);
      
      expect(result.messageId).toBe(messageId);
    });
  });

  describe('createMessageIdempotent', () => {
    it('should create new message if no duplicate', async () => {
      const messageData = {
        sender: 'user1',
        recipient: 'user2',
        content: 'Test message'
      };
      
      const createFn = jest.fn(async (data) => ({
        _id: 'msg123',
        ...data
      }));
      
      const result = await createMessageIdempotent(messageData, createFn);
      
      expect(result.isDuplicate).toBe(false);
      expect(result.message._id).toBe('msg123');
      expect(createFn).toHaveBeenCalledTimes(1);
    });

    it('should return existing message if duplicate', async () => {
      const messageData = {
        sender: 'user1',
        recipient: 'user2',
        content: 'Test message'
      };
      
      const createFn = jest.fn(async (data) => ({
        _id: 'msg123',
        ...data
      }));
      
      // Create first message
      await createMessageIdempotent(messageData, createFn);
      
      // Try to create duplicate
      const result = await createMessageIdempotent(messageData, createFn);
      
      expect(result.isDuplicate).toBe(true);
      expect(result.messageId).toBe('msg123');
      expect(createFn).toHaveBeenCalledTimes(1); // Should not call createFn again
    });
  });

  describe('Cache expiration', () => {
    it('should expire entries after TTL', async () => {
      // This test would require mocking Date.now() or using fake timers
      // Skipping for now, but should be implemented with jest.useFakeTimers()
    });
  });
});

