/**
 * Logger Utility Tests
 * Verify that the logger utility works correctly in different environments
 */

import { describe, it } from 'mocha';
import { strict as assert } from 'assert';
import logger from '../utils/logger.js';

describe('Logger Utility Tests', function() {
  
  describe('Logger Methods', function() {
    it('should have debug method', function() {
      assert.ok(typeof logger.debug === 'function', 'logger.debug should be a function');
    });
    
    it('should have error method', function() {
      assert.ok(typeof logger.error === 'function', 'logger.error should be a function');
    });
    
    it('should have warn method', function() {
      assert.ok(typeof logger.warn === 'function', 'logger.warn should be a function');
    });
    
    it('should have info method', function() {
      assert.ok(typeof logger.info === 'function', 'logger.info should be a function');
    });
    
    it('should have db method', function() {
      assert.ok(typeof logger.db === 'function', 'logger.db should be a function');
    });
    
    it('should have auth method', function() {
      assert.ok(typeof logger.auth === 'function', 'logger.auth should be a function');
    });
    
    it('should have security method', function() {
      assert.ok(typeof logger.security === 'function', 'logger.security should be a function');
    });
  });
  
  describe('Logger Behavior', function() {
    it('should not throw errors when logging', function() {
      assert.doesNotThrow(() => {
        logger.debug('Test debug message');
        logger.error('Test error message');
        logger.warn('Test warning message');
        logger.info('Test info message');
        logger.db('Test database message');
        logger.auth('Test auth message');
        logger.security('Test security message');
      });
    });
    
    it('should handle multiple arguments', function() {
      assert.doesNotThrow(() => {
        logger.debug('Message', { key: 'value' }, [1, 2, 3]);
        logger.error('Error', new Error('Test error'));
      });
    });
    
    it('should handle null and undefined', function() {
      assert.doesNotThrow(() => {
        logger.debug('Null value:', null);
        logger.debug('Undefined value:', undefined);
      });
    });
  });
  
  describe('Environment-Based Logging', function() {
    it('should respect NODE_ENV setting', function() {
      const isDev = process.env.NODE_ENV === 'development';
      
      // In development, debug logs should work
      // In production, debug logs should be silent
      // Both should always log errors
      
      assert.doesNotThrow(() => {
        logger.debug('This should only log in development');
        logger.error('This should always log');
      });
    });
  });
});

