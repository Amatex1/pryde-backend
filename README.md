# Pryde Chat Backend

A real-time chat application built with Node.js, Express, MongoDB, and Socket.io. Features include user authentication, direct messaging, image uploads, and read receipts.

## Features

- **User Authentication**: JWT-based signup and login
- **Real-time Chat**: Socket.io powered instant messaging
- **Image Uploads**: Send images in messages and set profile pictures
- **Read Receipts**: See when your messages have been read (✓✓)
- **User Directory**: Browse and start chats with other users
- **Profile Management**: Update display name, bio, and avatar

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.io
- **Authentication**: JWT (JSON Web Tokens)
- **File Uploads**: Multer
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Deployment**: Docker & Docker Compose

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

## Getting Started with Docker

### 1. Clone the repository

```bash
git clone https://github.com/Amatex1/pryde-backend.git
cd pryde-backend
```

### 2. Build and run with Docker Compose

```bash
docker-compose up --build
```

This will:
- Build the Node.js application container
- Start MongoDB in a separate container
- Mount the uploads directory for persistent file storage
- Create a named volume for MongoDB data persistence
- Expose the application on `http://localhost:3000`

### 3. Access the application

Open your browser and navigate to:
```
http://localhost:3000/frontend/pages/signup.html
```

## Project Structure

```
pryde-backend/
├── backend/
│   ├── config/
│   │   └── db.js              # MongoDB connection
│   ├── models/
│   │   ├── User.js            # User model (email, password, display_name, avatar_url, bio)
│   │   └── Message.js         # Message model (from, to, content, image_url, read_by)
│   ├── routes/
│   │   ├── auth.js            # Authentication routes (signup, login)
│   │   ├── users.js           # User routes (directory, profile)
│   │   └── messages.js        # Message routes (conversation, list)
│   ├── utils/
│   │   └── authMiddleware.js  # JWT authentication middleware
│   ├── uploads/
│   │   ├── profile-pictures/  # Profile image uploads
│   │   └── messages/          # Message image uploads
│   ├── sockets.js             # Socket.io event handlers
│   ├── server.js              # Express server setup
│   └── Dockerfile             # Docker configuration
├── frontend/
│   ├── pages/
│   │   ├── signup.html        # User registration
│   │   ├── login.html         # User login
│   │   ├── directory.html     # User directory/browse
│   │   ├── chat.html          # Chat interface
│   │   └── profile.html       # Profile management
│   ├── js/
│   │   ├── chat.js            # Chat functionality with Socket.io
│   │   └── profile.js         # Profile management
│   └── css/
│       └── style.css          # Application styles
├── docker-compose.yml         # Docker Compose configuration
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

## Environment Variables

The application uses the following environment variables (with defaults):

- `PORT`: Server port (default: 3000)
- `MONGO_URI`: MongoDB connection string (default: mongodb://mongo:27017/pryde)
- `JWT_SECRET`: Secret key for JWT tokens (default: secret_dev_key)
- `NODE_ENV`: Environment (default: production)

You can override these in `docker-compose.yml` or create a `.env` file for local development.

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login and receive JWT token
- `GET /api/auth/me` - Get current user (requires authentication)

### Users
- `GET /api/users` - Get all users (directory)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/profile` - Update own profile

### Messages
- `GET /api/messages/conversation/:userId` - Get messages with a user (paginated)
- `GET /api/messages/list` - Get list of conversations
- `DELETE /api/messages/conversation/:userId` - Delete conversation

### Uploads
- `POST /api/upload-profile` - Upload profile picture
- `POST /api/messages/upload-image` - Upload message image

## Socket.io Events

### Client → Server
- `chat:message` - Send a message (content and/or image_url)
- `message:read` - Mark messages as read
- `typing` - Send typing indicator

### Server → Client
- `chat:message` - Receive a new message
- `message:read` - Notification that messages were read
- `typing` - Receive typing indicator
- `user:online` - User came online
- `user:offline` - User went offline

## Testing & QA

### 1. Build and run with Docker

```bash
docker-compose up --build
```

### 2. Create test accounts

- Open `http://localhost:3000/frontend/pages/signup.html` in two different browsers or incognito windows
- Create two accounts with different email addresses

### 3. Test messaging

- Log in with both accounts
- From the directory, click "Chat" on the other user
- Send text messages and verify they appear in real-time
- Upload and send images using the attachment button (📎)
- Verify images load and display correctly

### 4. Test read receipts

- Send messages from User A to User B
- Check that messages show single tick (✓) when sent
- When User B views the chat, messages should show double tick (✓✓)
- User A should see the double tick update in real-time

### 5. Test profile uploads

- Navigate to the Profile page
- Upload a profile picture
- Update display name and bio
- Verify changes appear in the directory and chat

### 6. Test data persistence

```bash
# Stop containers
docker-compose down

# Start again
docker-compose up

# Your messages, images, and user data should still be there
```

## Development

For local development without Docker:

```bash
# Install dependencies
npm install

# Start MongoDB locally or use a cloud instance
# Update MONGO_URI in .env

# Run in development mode
npm run dev
```

## Docker Volumes

- `mongo-data`: Named volume for MongoDB data persistence
- `./backend/uploads`: Bind mount for uploaded files (profile pictures and message images)

## Security Notes

- Change `JWT_SECRET` in production
- Use HTTPS in production
- Implement rate limiting (already included)
- Validate and sanitize all user inputs
- Implement file size limits (already configured: 5MB for profiles, 10MB for messages)

## License

MIT

## Contributors

Built for the Pryde Social platform.
