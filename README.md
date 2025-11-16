# PRYDE Backend - Chat Application

A real-time chat application built with Node.js, Express, MongoDB, Socket.IO, and vanilla JavaScript.

## Features

- **User Authentication**: JWT-based authentication with signup/login
- **Real-time Chat**: WebSocket-based instant messaging using Socket.IO
- **Image Sharing**: Upload and share images in conversations
- **Read Receipts**: Double-tick system to show when messages are read
- **User Profiles**: Customizable profiles with avatars and bio
- **Online Status**: See who's online in real-time
- **Docker Support**: Easy deployment with Docker and Docker Compose

## Tech Stack

### Backend
- Node.js 18+
- Express.js
- MongoDB with Mongoose
- Socket.IO for real-time communication
- JWT for authentication
- Multer for file uploads
- bcrypt for password hashing

### Frontend
- Vanilla HTML/CSS/JavaScript
- Socket.IO client
- Responsive design

## Getting Started

### Prerequisites

- Docker and Docker Compose installed on your system
- Or Node.js 18+ and MongoDB if running without Docker

### Installation with Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/Amatex1/pryde-backend.git
cd pryde-backend
```

2. Create a `.env` file (optional, defaults provided):
```bash
cp .env.example .env
```

3. Start the application with Docker Compose:
```bash
docker-compose up --build
```

4. Access the application:
- Frontend: http://localhost:3000/frontend/pages/signup.html
- API: http://localhost:3000/api
- MongoDB: localhost:27017

### Installation without Docker

1. Install dependencies:
```bash
npm install
```

2. Start MongoDB locally (ensure it's running on port 27017)

3. Create a `.env` file:
```bash
cp .env.example .env
```

4. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
MONGO_URI=mongodb://localhost:27017/pryde
JWT_SECRET=your_secret_key_here
PORT=3000
```

## Testing & QA Steps

### 1. Basic Setup Test

```bash
docker-compose up --build
```

Visit http://localhost:3000/frontend/pages/signup.html

### 2. User Account Creation

1. Open the application in two different browsers or use incognito mode
2. Create two different user accounts using unique email addresses
3. Verify both accounts are created successfully and redirected to the directory

### 3. Chat Functionality

1. In the first browser, navigate to the user directory
2. Click on the second user's profile to start a chat
3. Send text messages from both accounts
4. Verify messages appear in real-time for both users
5. Send an image attachment using the 📎 button
6. Verify the image uploads and displays correctly in the conversation

### 4. Read Receipts

1. Send a message from User 1 to User 2
2. Verify User 1 sees a single tick (✓) indicating the message was sent
3. When User 2 opens the conversation and views the message
4. Verify User 1 now sees double ticks (✓✓) indicating the message was read
5. Test with the page in focus and out of focus

### 5. Profile Image Upload

1. Click on "My Profile" or "Profile" button
2. Upload a profile picture using the "Change Avatar" button
3. Return to the directory
4. Verify the avatar appears in the user list
5. Verify the avatar appears in chat conversations

### 6. Docker Persistence

1. Stop the containers: `docker-compose down`
2. Verify the `mongo-data` volume exists: `docker volume ls`
3. Restart the containers: `docker-compose up`
4. Log in with existing credentials
5. Verify all messages and images persist
6. Check that `./backend/uploads` directory contains uploaded files

### 7. Online Status

1. With both users logged in, verify online indicators appear
2. Log out one user and verify the status updates to offline
3. Test typing indicators by typing in the message box

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile (requires auth)

### Users
- `GET /api/users` - Get all users (requires auth)
- `GET /api/users/:userId` - Get user by ID (requires auth)
- `PUT /api/users/profile` - Update profile (requires auth)

### Messages
- `GET /api/messages/conversation/:withUserId` - Get conversation messages (requires auth)
- `GET /api/messages/list` - Get conversation list (requires auth)
- `POST /api/messages/delete-conversation/:withUserId` - Delete conversation (requires auth)

### Uploads
- `POST /api/upload-profile` - Upload profile picture (requires auth)
- `POST /api/messages/upload-image` - Upload message image (requires auth)

## Socket.IO Events

### Client → Server
- `join:chat` - Join a chat room
- `leave:chat` - Leave a chat room
- `chat:message` - Send a message
- `typing` - Send typing indicator
- `message:read` - Mark message as read

### Server → Client
- `chat:message` - Receive new message
- `typing` - Receive typing indicator
- `message:read` - Message read notification
- `user:online` - User came online
- `user:offline` - User went offline

## Project Structure

```
pryde-backend/
├── backend/
│   ├── models/
│   │   ├── db.js          # MongoDB connection
│   │   ├── User.js        # User model
│   │   └── Message.js     # Message model
│   ├── routes/
│   │   ├── auth.js        # Authentication routes
│   │   ├── users.js       # User routes
│   │   └── messages.js    # Message routes
│   ├── utils/
│   │   └── authMiddleware.js  # JWT middleware
│   ├── uploads/
│   │   ├── profile-pictures/  # Profile images
│   │   └── messages/          # Message images
│   ├── sockets.js         # Socket.IO handlers
│   ├── server.js          # Express server
│   └── Dockerfile         # Docker configuration
├── frontend/
│   ├── pages/
│   │   ├── signup.html    # Signup page
│   │   ├── login.html     # Login page
│   │   ├── directory.html # User directory
│   │   ├── chat.html      # Chat interface
│   │   └── profile.html   # Profile page
│   ├── js/
│   │   ├── auth.js        # Authentication logic
│   │   ├── directory.js   # Directory logic
│   │   ├── chat.js        # Chat logic with Socket.IO
│   │   └── profile.js     # Profile logic
│   └── css/
│       └── style.css      # Styles
├── docker-compose.yml     # Docker Compose configuration
├── package.json           # Dependencies
├── .env.example          # Environment variables template
└── README.md             # This file
```

## Development

To contribute or develop:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly using the QA steps above
5. Submit a pull request

## Security Notes

- JWT tokens are used for authentication
- Passwords are hashed with bcrypt
- File uploads are validated and size-limited
- CORS is configured for cross-origin requests
- Use strong JWT_SECRET in production

## Docker Volumes

- `mongo-data`: Persists MongoDB data
- `./backend/uploads`: Persists uploaded files (mounted as volume)

## Troubleshooting

### Port already in use
If port 3000 or 27017 is already in use, stop other services or change ports in `docker-compose.yml`.

### MongoDB connection issues
Ensure MongoDB container is running: `docker-compose ps`

### Upload issues
Check that `backend/uploads` directory has proper permissions and is mounted correctly.

## License

MIT License - see LICENSE file for details

## Support

For issues or questions, please open an issue on GitHub.
