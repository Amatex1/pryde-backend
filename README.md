# Pryde Backend

A real-time chat application with Docker support, MongoDB, and image upload capabilities.

## Features

- **User Authentication**: JWT-based authentication with signup/login
- **Real-time Messaging**: Socket.io powered chat with typing indicators
- **Image Uploads**: Support for profile pictures and message image attachments
- **Read Receipts**: Track message read status with visual indicators (✓/✓✓)
- **User Directory**: Browse and connect with other users
- **Docker Support**: Easy deployment with Docker Compose
- **MongoDB**: Scalable NoSQL database with Mongoose ODM

## Tech Stack

- **Backend**: Node.js, Express, Socket.io
- **Database**: MongoDB with Mongoose
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Containerization**: Docker & Docker Compose

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Or Node.js 18+ and MongoDB (for local development)

### Running with Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd pryde-backend
```

2. Build and run with Docker Compose:
```bash
docker-compose up --build
```

3. Access the application:
- Frontend: http://localhost:3000/frontend/pages/signup.html
- API: http://localhost:3000/api
- MongoDB: localhost:27017

### Running Locally (Development)

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
```
PORT=3000
MONGO_URI=mongodb://localhost:27017/pryde
JWT_SECRET=your_secure_secret_key_here
NODE_ENV=development
```

4. Start MongoDB (if not using Docker):
```bash
# Using Homebrew on macOS
brew services start mongodb-community

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:7
```

5. Run the application:
```bash
npm start

# Or for development with auto-reload:
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user profile (requires auth)
- `PUT /api/auth/profile` - Update user profile (requires auth)
- `GET /api/auth/users` - Get all users (requires auth)

### Messages
- `GET /api/messages/conversation/:userId` - Get conversation messages (requires auth)
- `GET /api/messages/list` - Get conversation list (requires auth)
- `DELETE /api/messages/conversation/:userId` - Delete conversation (requires auth)

### Uploads
- `POST /api/upload-profile` - Upload profile picture (requires auth)
- `POST /api/messages/upload-image` - Upload message image (requires auth)

## Socket.io Events

### Client → Server
- `chat:message` - Send a message
- `message:read` - Mark messages as read
- `typing` - Send typing indicator

### Server → Client
- `chat:message` - Receive a message
- `message:read` - Message read confirmation
- `typing` - Typing indicator from other user
- `user:online` - User came online
- `user:offline` - User went offline

## Project Structure

```
pryde-backend/
├── config/
│   └── db.js                 # MongoDB connection
├── models/
│   ├── User.js               # User model
│   ├── Message.js            # Message model
│   └── Conversation.js       # Conversation model (legacy)
├── routes/
│   ├── auth.js               # Authentication routes
│   └── messages.js           # Message routes
├── middleware/
│   └── auth.js               # JWT authentication middleware
├── frontend/
│   ├── pages/
│   │   ├── signup.html       # Signup page
│   │   ├── login.html        # Login page
│   │   ├── directory.html    # User directory
│   │   ├── chat.html         # Chat interface
│   │   └── profile.html      # User profile
│   ├── js/
│   │   ├── auth.js           # Authentication logic
│   │   ├── directory.js      # User directory logic
│   │   ├── chat.js           # Chat logic
│   │   └── profile.js        # Profile logic
│   └── css/
│       └── styles.css        # Styles
├── uploads/                  # Upload directory (created at runtime)
│   ├── profile-pictures/     # Profile images
│   └── messages/             # Message images
├── sockets.js                # Socket.io configuration
├── server.js                 # Main server file
├── Dockerfile                # Docker configuration
├── docker-compose.yml        # Docker Compose configuration
├── package.json              # Node.js dependencies
└── README.md                 # This file
```

## Testing & QA Steps

1. **Build and Run**:
   ```bash
   docker-compose up --build
   ```
   Visit http://localhost:3000/frontend/pages/signup.html

2. **User Registration**:
   - Create two accounts using different browsers or incognito mode
   - Verify successful signup and automatic login

3. **Chat Functionality**:
   - Open user directory and find the other user
   - Click "Chat" to open conversation
   - Send text messages - verify they appear in recipient window
   - Upload and send an image - verify image loads correctly

4. **Read Receipts**:
   - Send messages from User A to User B
   - Open chat on User B's side
   - Verify User A sees ✓✓ (double check) on messages after User B views them

5. **Profile Management**:
   - Navigate to profile page
   - Upload a profile picture
   - Update display name and bio
   - Verify changes appear in user directory

6. **Data Persistence**:
   - Stop and restart Docker containers
   - Verify MongoDB data persists (named volume `mongo-data`)
   - Verify uploaded images persist (mounted volume `./uploads`)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/pryde` |
| `JWT_SECRET` | Secret key for JWT | `secret_dev_key` |
| `NODE_ENV` | Environment mode | `development` |

## Docker Volumes

- `mongo-data`: Named volume for MongoDB data persistence
- `./uploads`: Bind mount for uploaded files (profile pictures and message images)

## Security Notes

- Always use a strong `JWT_SECRET` in production
- File uploads are limited to images only
- Profile pictures: max 5MB
- Message images: max 10MB
- CORS is enabled for development (configure for production)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC
