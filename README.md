# PRYDE Chat - Real-time Messaging Application

A full-featured chat application with Docker support, MongoDB backend, Socket.io for real-time messaging, JWT authentication, image uploads, and read receipts.

## Features

- 🔐 **JWT Authentication** - Secure user signup and login
- 💬 **Real-time Messaging** - Instant message delivery using Socket.io
- 📸 **Image Attachments** - Upload and share images in conversations
- ✓✓ **Read Receipts** - Know when your messages have been read
- 👤 **Profile Management** - Update display name, bio, and avatar
- 👥 **User Directory** - Browse and connect with other users
- 🐳 **Docker Support** - Easy deployment with docker-compose
- 🗄️ **MongoDB** - Persistent data storage with Mongoose ODM

## Tech Stack

**Backend:**
- Node.js 18+
- Express.js
- Socket.io
- MongoDB with Mongoose
- JWT for authentication
- Multer for file uploads
- bcrypt for password hashing

**Frontend:**
- Vanilla HTML/CSS/JavaScript
- Socket.io client
- Responsive design

## Prerequisites

- Docker and Docker Compose (recommended)
- OR Node.js 18+ and MongoDB installed locally

## Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone https://github.com/Amatex1/pryde-backend.git
   cd pryde-backend
   ```

2. **Create environment file (optional)**
   ```bash
   cp .env.example .env
   # Edit .env to set JWT_SECRET if desired
   ```

3. **Build and run with docker-compose**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Open your browser to: http://localhost:3000/frontend/pages/signup.html
   - Create an account and start chatting!

The application will be running on port 3000, and MongoDB will be on port 27017.

## Running Locally (without Docker)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start MongoDB**
   Make sure MongoDB is running on `mongodb://localhost:27017`

3. **Create .env file**
   ```bash
   cp .env.example .env
   ```

4. **Start the application**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

5. **Access the application**
   Open http://localhost:3000/frontend/pages/signup.html

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/pryde
JWT_SECRET=your_secret_key_here_change_in_production
```

## Project Structure

```
pryde-backend/
├── backend/
│   ├── config/
│   │   └── db.js                 # MongoDB connection
│   ├── models/
│   │   ├── User.js              # User model
│   │   └── Message.js           # Message model
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   └── messages.js          # Message routes
│   ├── utils/
│   │   └── authMiddleware.js    # JWT middleware
│   ├── sockets.js               # Socket.io logic
│   ├── server.js                # Express server
│   ├── Dockerfile               # Docker image config
│   └── uploads/                 # Uploaded files
│       ├── profile-pictures/
│       └── messages/
├── frontend/
│   ├── pages/
│   │   ├── signup.html          # Signup page
│   │   ├── login.html           # Login page
│   │   ├── directory.html       # User directory
│   │   ├── chat.html            # Chat interface
│   │   └── profile.html         # User profile
│   ├── js/
│   │   ├── directory.js         # Directory logic
│   │   ├── chat.js              # Chat + Socket.io logic
│   │   └── profile.js           # Profile management
│   └── css/
│       └── styles.css           # Global styles
├── docker-compose.yml           # Docker compose config
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users` - Get all users (requires auth)
- `GET /api/profile` - Get current user profile (requires auth)
- `PUT /api/profile` - Update profile (requires auth)

### Messages
- `GET /api/messages/conversation/:userId` - Get conversation with a user (requires auth)
- `GET /api/messages/list` - Get all conversations (requires auth)
- `DELETE /api/messages/delete-conversation/:userId` - Delete conversation (requires auth)

### Uploads
- `POST /api/upload-profile` - Upload profile picture (requires auth)
- `POST /api/messages/upload-image` - Upload message image (requires auth)

## Socket.io Events

### Client → Server
- `chat:message` - Send a message (content and/or image_url)
- `message:read` - Mark messages as read
- `typing` - Send typing indicator

### Server → Client
- `chat:message` - Receive a message
- `message:read` - Receive read receipt
- `typing` - Receive typing indicator
- `user:online` - User came online
- `user:offline` - User went offline

## Usage Guide

### 1. Sign Up
- Visit http://localhost:3000/frontend/pages/signup.html
- Enter email, display name, and password
- Click "Sign Up"

### 2. Browse Users
- After signup, you'll be redirected to the directory
- View all registered users
- Click on a user to start a chat

### 3. Send Messages
- Type a message in the input field
- Press Enter or click send button
- Messages appear instantly for online recipients

### 4. Send Images
- Click the 📎 (attach) button
- Select an image file
- Image uploads and sends automatically

### 5. Read Receipts
- Sent messages show ✓✓ when read by recipient
- Messages are marked as read when the conversation is viewed

### 6. Update Profile
- Click "Profile" in the navigation
- Update your display name and bio
- Upload a profile picture
- Changes are saved and visible to other users

## Docker Volumes

The docker-compose setup uses:
- **mongo-data**: Named volume for MongoDB persistence
- **./backend/uploads**: Bind mount for uploaded files persistence

## Testing & QA Steps

1. **Build and Run**
   ```bash
   docker-compose up --build
   ```
   Visit http://localhost:3000/frontend/pages/signup.html

2. **Create Accounts**
   - Sign up with two different accounts
   - Use different browsers or incognito mode

3. **Test Messaging**
   - Open directory and select a user to chat
   - Send text messages
   - Attach and send images
   - Verify messages appear in real-time

4. **Test Read Receipts**
   - Send messages from User A to User B
   - View messages as User B
   - Check that User A sees ✓✓ on read messages

5. **Test Profile Upload**
   - Go to profile page
   - Upload a profile picture
   - Verify avatar appears in directory and chat

6. **Test Persistence**
   - Stop containers: `docker-compose down`
   - Restart: `docker-compose up`
   - Verify users, messages, and images persist

## Troubleshooting

**Port already in use:**
- Change PORT in .env file
- Or stop the conflicting service

**MongoDB connection error:**
- Ensure MongoDB container is running
- Check MONGO_URI in .env

**Images not loading:**
- Check backend/uploads directory exists
- Verify file permissions

**Socket.io connection failed:**
- Check browser console for errors
- Verify JWT token is valid
- Clear localStorage and re-login

## Development

For development with auto-reload:

```bash
npm run dev
```

To view logs:

```bash
docker-compose logs -f app
```

## Security Notes

- Change JWT_SECRET in production
- Use HTTPS in production
- Implement rate limiting for production
- Add input validation and sanitization
- Consider adding CSRF protection

## License

MIT

## Contributing

Pull requests are welcome! Please ensure code quality and add tests for new features.
