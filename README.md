# PRYDE Chat - Real-time Messaging Application

A full-stack real-time chat application with Docker deployment, MongoDB database, image uploads, and read receipts.

## Features

- 🔐 JWT-based authentication (signup/login)
- 💬 Real-time messaging with Socket.io
- 📷 Image uploads (profile pictures and message images)
- ✓✓ Read receipts (double checkmark when read)
- 👥 User directory to find and chat with users
- 📱 Responsive vanilla HTML/CSS/JS frontend
- 🐳 Docker & Docker Compose for easy deployment
- 🗄️ MongoDB database with Mongoose ODM

## Tech Stack

**Backend:**
- Node.js 18
- Express.js
- Socket.io (real-time messaging)
- MongoDB with Mongoose
- JWT authentication
- Multer (file uploads)
- bcrypt (password hashing)

**Frontend:**
- Vanilla HTML/CSS/JavaScript
- Socket.io client
- Responsive design

**DevOps:**
- Docker & Docker Compose
- MongoDB 6

## Quick Start with Docker

### Prerequisites

- Docker and Docker Compose installed
- Git

### Installation & Setup

1. Clone the repository:
```bash
git clone https://github.com/Amatex1/pryde-backend.git
cd pryde-backend
```

2. Create a `.env` file (optional - uses defaults if not provided):
```bash
cp .env.example .env
# Edit .env if needed
```

3. Build and run with Docker Compose:
```bash
docker-compose up --build
```

4. Access the application:
- Open your browser and navigate to: `http://localhost:3000/frontend/pages/signup.html`

### Default Configuration

If no `.env` file is provided, the application uses these defaults:
- `MONGO_URI`: `mongodb://mongo:27017/pryde`
- `JWT_SECRET`: `secret_dev_key`
- `PORT`: `3000`

## Testing & QA Steps

### 1. Initial Setup and Account Creation

```bash
# Start the application
docker-compose up --build
```

- Open browser and visit: `http://localhost:3000/frontend/pages/signup.html`
- Create first user account:
  - Email: `user1@test.com`
  - Password: `password123`
  - Display Name: `User One`
  - Bio: `First test user`
- Click "Sign Up"
- You should be redirected to the directory page

### 2. Create Second Account

- Open a second browser window (or incognito/private mode)
- Visit: `http://localhost:3000/frontend/pages/signup.html`
- Create second user account:
  - Email: `user2@test.com`
  - Password: `password123`
  - Display Name: `User Two`
  - Bio: `Second test user`
- Click "Sign Up"

### 3. Test User Directory

- In either browser window, you should see both users in the directory
- Verify that user cards display:
  - Display name
  - Bio
  - Avatar placeholder (first letter of name)

### 4. Test Profile Image Upload

- Click "My Profile" link
- Click "Change Avatar" button
- Select an image file from your computer
- Verify the avatar updates in the profile page
- Navigate back to directory and verify avatar appears there too

### 5. Test Chat Functionality

**From User One's browser:**
- Click on "User Two" in the directory
- Should be redirected to chat page
- Type and send a text message: "Hello User Two!"
- Verify message appears with single checkmark (✓)

**From User Two's browser:**
- Navigate to chat page or click "My Chats"
- Should see conversation with User One
- Click on the conversation
- Verify you receive User One's message
- Send a reply: "Hi User One!"

**Back to User One's browser:**
- Verify you receive User Two's message in real-time
- Verify your sent message now shows double checkmark (✓✓) indicating it was read

### 6. Test Image Messages

**From User One's browser:**
- In the chat with User Two, click the camera icon (📷)
- Select an image file
- Optionally add text: "Check out this image!"
- Click Send
- Verify image appears in the chat

**From User Two's browser:**
- Verify you receive the image message in real-time
- Verify the image displays correctly
- Click on the image to view it full size

### 7. Test Typing Indicators

- Start typing in the message input (but don't send)
- In the other browser, verify "typing..." indicator appears
- Stop typing for 2 seconds
- Verify typing indicator disappears

### 8. Test Read Receipts

- Send several messages from one user
- Don't open the chat in the other browser yet
- Messages should show single checkmark (✓)
- Now open the chat in the other browser
- Switch back to the first browser
- Verify all messages now show double checkmark (✓✓)

### 9. Test Data Persistence

```bash
# Stop the containers
docker-compose down

# Restart (without --build)
docker-compose up
```

- Login again with either account
- Verify:
  - All messages are still there
  - Profile pictures are still there
  - Chat history is preserved

### 10. Verify Docker Volumes

```bash
# Check Docker volumes
docker volume ls

# Should see:
# pryde-backend_mongo-data

# Check that uploads directory exists and contains files
ls -la backend/uploads/profile-pictures/
ls -la backend/uploads/messages/
```

### 11. Test Multiple Conversations

- Create a third user account
- From User One, start conversations with both User Two and User Three
- Verify:
  - Conversation list shows all conversations
  - Last message preview appears for each conversation
  - Switching between conversations works correctly
  - Unread messages are marked correctly

### 12. Test Logout and Login

- Logout from any account
- Login again with the same credentials
- Verify you can access all previous conversations
- Verify read receipts are maintained

## Manual Development (without Docker)

If you want to run without Docker for development:

1. Install MongoDB locally or use a cloud instance
2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```
MONGO_URI=mongodb://localhost:27017/pryde
JWT_SECRET=your_secret_key_here
PORT=3000
```

4. Run the server:
```bash
npm run dev
```

## Project Structure

```
pryde-backend/
├── backend/
│   ├── models/
│   │   ├── db.js              # MongoDB connection
│   │   ├── User.js            # User model
│   │   └── Message.js         # Message model
│   ├── routes/
│   │   ├── auth.js            # Authentication routes
│   │   ├── users.js           # User management routes
│   │   └── messages.js        # Message routes
│   ├── utils/
│   │   └── authMiddleware.js  # JWT authentication middleware
│   ├── uploads/               # Uploaded files (gitignored)
│   │   ├── profile-pictures/
│   │   └── messages/
│   ├── sockets.js             # Socket.io handlers
│   ├── server.js              # Main server file
│   └── Dockerfile             # Docker configuration
├── frontend/
│   ├── pages/
│   │   ├── signup.html        # Signup page
│   │   ├── login.html         # Login page
│   │   ├── directory.html     # User directory
│   │   ├── chat.html          # Chat interface
│   │   └── profile.html       # Profile management
│   ├── js/
│   │   ├── auth.js            # Authentication logic
│   │   ├── chat.js            # Chat functionality
│   │   └── profile.js         # Profile management
│   └── css/
│       └── styles.css         # Application styles
├── docker-compose.yml         # Docker Compose configuration
├── package.json               # Node.js dependencies
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update current user profile
- `GET /api/users/directory` - Get all users
- `GET /api/users/:userId` - Get specific user
- `POST /api/upload-profile` - Upload profile picture

### Messages
- `GET /api/messages/conversation/:withUserId` - Get conversation with user
- `GET /api/messages/list` - Get all conversations
- `POST /api/messages/delete-conversation/:withUserId` - Delete conversation
- `POST /api/messages/upload-image` - Upload message image

### Socket.io Events

**Client → Server:**
- `join:chat` - Join a chat room
- `leave:chat` - Leave a chat room
- `chat:message` - Send a message
- `typing` - Typing indicator
- `message:read` - Mark messages as read

**Server → Client:**
- `chat:message` - Receive message in current room
- `new:message` - Receive message notification
- `typing` - Typing indicator from other user
- `message:read` - Message read confirmation
- `user:online` - User came online
- `user:offline` - User went offline

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb://mongo:27017/pryde` |
| `JWT_SECRET` | Secret key for JWT tokens | `secret_dev_key` |
| `PORT` | Server port | `3000` |

## Security Features

- 🔒 Password hashing with bcrypt
- 🎫 JWT-based authentication
- ✅ Token validation on all protected routes
- 🚫 Banned user detection
- 🛡️ Socket.io authentication
- 📁 File upload validation (type and size)

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB container is running
docker ps

# Check MongoDB logs
docker-compose logs mongo

# Restart containers
docker-compose restart
```

### File Upload Issues
```bash
# Check upload directories exist
ls -la backend/uploads/

# Check directory permissions
chmod -R 755 backend/uploads/
```

### Socket.io Connection Issues
- Ensure you're using the correct URL scheme (http/https)
- Check browser console for errors
- Verify JWT token is valid and not expired

## Development

To make changes and see them reflected:

1. **Backend changes**: Restart the Docker containers
```bash
docker-compose restart app
```

2. **Frontend changes**: Just refresh the browser (static files are served directly)

## Production Deployment

For production, consider:

1. Use strong `JWT_SECRET` (generate random string)
2. Use managed MongoDB service (MongoDB Atlas)
3. Add HTTPS/SSL certificates
4. Set up proper CORS origins
5. Add rate limiting
6. Implement proper logging
7. Add monitoring and alerts
8. Configure proper backups for MongoDB

## License

MIT License

## Contributors

PRYDE Development Team
