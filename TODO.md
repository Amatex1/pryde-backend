# TODO: Fix Encrypted Messages Issue on /messages Pages

## Problem
Messages are showing up as encrypted on the /messages pages instead of decrypted plaintext.

## Root Cause
The `GET /:userId` and `GET /group/:groupId` endpoints rely on the model's `toJSON()` method for decryption, which may fail in certain edge cases. In contrast, the `/list` and `/` endpoints have explicit decryption logic that works correctly.

## Plan

### Step 1: Add explicit decryption to GET /:userId endpoint
- Import `decryptMessage` and `isEncrypted` from encryption utilities
- Add decryption logic similar to `/list` endpoint
- Handle both object and JSON string formats for backward compatibility

### Step 2: Add explicit decryption to GET /group/:groupId endpoint
- Import `decryptMessage` and `isEncrypted` from encryption utilities  
- Add decryption logic to each message before returning

### Step 3: Test the changes
- Verify messages are decrypted on /messages pages

## Files to Edit
- `server/routes/messages.js`
  - `GET /:userId` endpoint (around line 199)
  - `GET /group/:groupId` endpoint (around line 584)
