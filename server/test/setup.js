/**
 * Test Setup File
 * 
 * This file is loaded BEFORE all test files via mocha --require
 * It sets NODE_ENV=test to ensure rate limiters are bypassed.
 */

// Set NODE_ENV before any other imports
process.env.NODE_ENV = 'test';

console.log('[Test Setup] NODE_ENV set to:', process.env.NODE_ENV);

