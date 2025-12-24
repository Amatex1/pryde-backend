# Pryde Social - Social Networking Platform

A modern, real-time social networking platform built with React, Node.js, and MongoDB.

## 🌟 Features

- **User Authentication** - Secure JWT-based authentication
- **Real-time Messaging** - Socket.IO powered instant messaging
- **Friend System** - Send and accept friend requests
- **Posts & Feed** - Create, like, and comment on posts
- **Notifications** - Real-time notifications for interactions
- **Profile Management** - Customizable user profiles
- **Image Uploads** - Share photos with friends
- **Push Notifications** - Web push notifications support

## 🚀 Quick Start

**Want to deploy quickly?** Start here: **[docs/QUICK_START.md](./docs/QUICK_START.md)**

This guide will get you deployed in about 1 hour.

## 📚 Documentation

**All documentation has been moved to the [`docs/`](./docs/) folder.**

📖 **[View Documentation Index](./docs/INDEX.md)** - Complete organized documentation

### Quick Links
- **[Quick Start Guide](./docs/QUICK_START.md)** - Fast deployment guide (~1 hour)
- **[Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)** - Complete deployment overview
- **[Daily Backup Setup](./docs/DAILY_BACKUP_SETUP.md)** - Backup system guide
- **[MongoDB Fix Guide](./docs/MONGODB_FIX_GUIDE.md)** - Database troubleshooting
- **[Security Implementation](./docs/SECURITY_IMPLEMENTATION.md)** - Security features
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client
- **Socket.IO Client** - Real-time communication

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Socket.IO** - Real-time engine
- **JWT** - Authentication
- **Multer** - File uploads
- **Web Push** - Push notifications

## 📦 Project Structure

```
pryde-backend/
├── dist/                    # Frontend production build
├── public/                  # Public assets
├── src/                     # Frontend source code
│   ├── components/         # React components
│   ├── pages/              # Page components
│   ├── config/             # Configuration files
│   └── utils/              # Utility functions
├── server/                  # Backend source code
│   ├── config/             # Server configuration
│   ├── models/             # Mongoose models
│   ├── routes/             # API routes
│   ├── middleware/         # Express middleware
│   ├── scripts/            # Utility scripts (backups, etc.)
│   └── server.js           # Main server file
├── docs/                    # Documentation (99 files)
│   └── INDEX.md            # Documentation index
└── README.md               # This file
```

## 🏃 Local Development

### Prerequisites
- Node.js 16+ installed
- MongoDB installed locally or MongoDB Atlas account
- Git installed

### Frontend Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Frontend runs on: `http://localhost:3000`

### Backend Development

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env with your configuration
# Add your MongoDB connection string, JWT secret, etc.

# Start development server
npm run dev

# Or start production server
npm start
```

Backend runs on: `http://localhost:9000`

## 🌐 Deployment

### Production Deployment

**Frontend**: SiteGround (Apache hosting)
**Backend**: Render.com (Node.js hosting)
**Database**: MongoDB Atlas (Cloud database)

Follow the **[QUICK_START.md](./QUICK_START.md)** guide for deployment instructions.

### Environment Variables

#### Frontend (.env.production)
```env
VITE_API_URL=https://your-backend.onrender.com/api
VITE_SOCKET_URL=https://your-backend.onrender.com
```

#### Backend (Render.com)
```env
NODE_ENV=production
PORT=10000
MONGO_URL=mongodb+srv://...
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
BASE_URL=https://your-backend.onrender.com
FRONTEND_URL=https://your-domain.com
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
```

## 🔧 Available Scripts

### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run build:prod   # Build with production env
npm run preview      # Preview production build
```

### Backend
```bash
npm run server:dev   # Start backend dev server (from root)
npm run server:start # Start backend prod server (from root)
```

## 🧪 Testing

After deployment, test these features:
- [ ] User registration
- [ ] User login
- [ ] Create posts
- [ ] Like/comment on posts
- [ ] Send friend requests
- [ ] Accept friend requests
- [ ] Send messages
- [ ] Receive real-time notifications
- [ ] Upload images
- [ ] Update profile

## 🔒 Security

- HTTPS enforced on both frontend and backend
- JWT-based authentication
- Secure password hashing with bcrypt
- CORS properly configured
- Environment variables for sensitive data
- Security headers configured

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is private and proprietary.

## 🆘 Support

Need help? Check these resources:
1. **[Documentation Index](./docs/INDEX.md)** - Complete documentation index
2. **[Quick Start Guide](./docs/QUICK_START.md)** - Quick deployment guide
3. **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions
4. **[Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)** - Complete deployment documentation

## 🎉 Ready to Deploy?

Everything is set up and ready to go! Follow the **[Quick Start Guide](./docs/QUICK_START.md)** to deploy your app in about an hour.

---

**Built with ❤️ using React, Node.js, and MongoDB**

