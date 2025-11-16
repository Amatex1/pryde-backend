# PRYDE Chat - Testing Guide

## Quick Test Script

This guide helps you quickly verify all features of the PRYDE Chat application.

### Prerequisites
- Docker and Docker Compose installed
- Two different browsers (or one browser + one incognito window)

### Step 1: Start the Application

```bash
# Clone the repository (if not already done)
git clone https://github.com/Amatex1/pryde-backend.git
cd pryde-backend

# Start with Docker Compose
docker-compose up --build

# Wait for both services to be ready:
# ✅ MongoDB connected
# ✅ PRYDE backend running on port 3000
```

### Step 2: Create Test Users

**Browser 1 - User One:**
1. Navigate to: http://localhost:3000/frontend/pages/signup.html
2. Fill in:
   - Email: `alice@test.com`
   - Display Name: `Alice`
   - Password: `password123`
3. Click "Sign Up"
4. You'll be redirected to the directory

**Browser 2 (Incognito) - User Two:**
1. Navigate to: http://localhost:3000/frontend/pages/signup.html
2. Fill in:
   - Email: `bob@test.com`
   - Display Name: `Bob`
   - Password: `password123`
3. Click "Sign Up"
4. You'll be redirected to the directory

### Step 3: Test Profile Pictures

**As Alice (Browser 1):**
1. Click "Profile" in the top navigation
2. Click "Change Avatar"
3. Select an image file (JPG, PNG, etc.)
4. Verify avatar appears in the profile page
5. Go back to "Directory"
6. Verify your avatar shows in your user card

**As Bob (Browser 2):**
1. Repeat the same steps with a different image

### Step 4: Test Chat Messaging

**As Alice (Browser 1):**
1. In the directory, click on "Bob's" user card
2. You'll be taken to the chat page
3. Type a message: "Hi Bob, this is Alice!"
4. Press Enter or click send button
5. Message should appear on the right side (sent)

**As Bob (Browser 2):**
1. You should see a new conversation appear in the left sidebar
2. Or click on "Alice" from the directory
3. You should see Alice's message on the left side (received)
4. Reply: "Hello Alice, nice to meet you!"
5. Alice should see this message in real-time

### Step 5: Test Image Attachments

**As Alice (Browser 1):**
1. In the chat with Bob, click the 📎 (paperclip) button
2. Select an image file
3. Image will upload and send automatically
4. Verify image appears in your chat

**As Bob (Browser 2):**
1. Verify the image appears in your chat in real-time
2. Try sending an image back to Alice

### Step 6: Test Read Receipts

**As Alice (Browser 1):**
1. Send several messages to Bob
2. Notice messages initially don't have ✓✓

**As Bob (Browser 2):**
1. Open the chat with Alice (if not already open)
2. Scroll through messages

**As Alice (Browser 1):**
1. Watch your messages get ✓✓ (double checkmark)
2. This confirms Bob has read them

### Step 7: Test Message History

**As either user:**
1. Refresh the page (F5)
2. Log back in if needed
3. Go back to your conversation
4. Verify all messages are still there
5. Verify images still load correctly

### Step 8: Test Persistence

**Stop and restart the application:**
```bash
# Stop containers
docker-compose down

# Start again
docker-compose up
```

**Verify:**
1. Users can log back in with same credentials
2. All messages are preserved
3. Profile pictures still load
4. Conversation history is intact

### Step 9: Test Multiple Conversations

**As Alice (Browser 1):**
1. Go back to Directory
2. Create a third user account in another browser/incognito
3. Start conversations with multiple users
4. Verify conversation list shows all chats
5. Verify switching between conversations works

### Expected Results Checklist

- [ ] ✅ Users can sign up with email/password
- [ ] ✅ Users can log in
- [ ] ✅ Users appear in directory with avatars
- [ ] ✅ Profile pictures can be uploaded
- [ ] ✅ Real-time messages are delivered instantly
- [ ] ✅ Images can be sent in chat
- [ ] ✅ Images display correctly in messages
- [ ] ✅ Read receipts show ✓✓ when messages are read
- [ ] ✅ Conversation list updates with new messages
- [ ] ✅ Message history persists after refresh
- [ ] ✅ Data persists after container restart
- [ ] ✅ Multiple conversations work correctly

### Troubleshooting

**Can't connect to server:**
- Check Docker containers are running: `docker ps`
- Check logs: `docker-compose logs app`

**Images not loading:**
- Check uploads directory exists: `ls -la backend/uploads`
- Check permissions on uploads directory

**Messages not in real-time:**
- Check Socket.io connection in browser console
- Verify JWT token is valid

**Database errors:**
- Check MongoDB container: `docker-compose logs mongo`
- Verify MONGO_URI environment variable

### Performance Testing

**Load Test:**
1. Create 10+ user accounts
2. Send 100+ messages between users
3. Upload multiple images
4. Verify performance remains good

**Concurrent Users:**
1. Open 5+ browser tabs with different users
2. All send messages simultaneously
3. Verify all messages are delivered

### Security Testing

**Rate Limiting:**
1. Try to make 20+ rapid signup attempts
2. Should be blocked after 10 attempts in 15 minutes

**Authentication:**
1. Try to access `/api/users` without token
2. Should get 401 Unauthorized

**File Upload Limits:**
1. Try to upload a file > 10MB
2. Should be rejected

---

## Automated Test Script

If you prefer, here's a bash script to automate some tests:

```bash
#!/bin/bash
API_URL="http://localhost:3000"

# Test signup
echo "Testing signup..."
curl -X POST "$API_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123","display_name":"Test User"}'

# Test login
echo "\nTesting login..."
TOKEN=$(curl -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

# Test get users
echo "\nTesting get users..."
curl "$API_URL/api/users" \
  -H "Authorization: Bearer $TOKEN"

echo "\nAll tests completed!"
```

Save as `test.sh`, make executable with `chmod +x test.sh`, and run with `./test.sh`.
