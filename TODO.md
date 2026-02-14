# TODO - Fix Encrypted Messages Issue

## Task
Fix messages showing as encrypted on the /messages pages

## Root Cause
The `/list` and `/` routes use MongoDB aggregation (`Message.aggregate()`) which bypasses Mongoose's `toJSON()` method. The manual decryption code has a bug - it checks if `content` is a string and tries to `JSON.parse()` it, but in aggregation results, the content is already an object.

## Plan

### Step 1: Fix decryption in /list route
- [x] Update decryption logic in server/routes/messages.js to handle both object and string formats

### Step 2: Fix decryption in / route  
- [x] Update decryption logic in server/routes/messages.js to handle both object and string formats

### Step 3: Verify the fix
- [x] Test the changes by running the application

## Summary
Fixed the encrypted messages issue by updating the decryption logic in both `/list` and `/` routes in `server/routes/messages.js`. The fix properly handles both:
- Object format (from aggregation - MongoDB stores the encrypted object directly)
- JSON string format (for backward compatibility with data stored as string)

The key change was to check if the parsed JSON actually contains encrypted data (iv, authTag, encryptedData) before treating it as encrypted, and to properly handle the case where content is already an object from MongoDB aggregation results.
