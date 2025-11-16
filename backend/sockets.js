import jwt from 'jsonwebtoken';
import Message from './models/Message.js';
import User from './models/User.js';

// Map to track online users: userId -> Set of socketIds
const onlineUsers = new Map();

/**
 * Initialize Socket.IO with authentication and chat handlers
 */
export const initializeSockets = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const jwtSecret = process.env.JWT_SECRET || 'secret_dev_key';
      const decoded = jwt.verify(token, jwtSecret);

      const user = await User.findById(decoded.userId);
      if (!user || user.banned) {
        return next(new Error('Invalid user'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);

    // Add user to online users map
    if (!onlineUsers.has(socket.userId)) {
      onlineUsers.set(socket.userId, new Set());
    }
    onlineUsers.get(socket.userId).add(socket.id);

    // Broadcast user online status
    socket.broadcast.emit('user:online', { userId: socket.userId });

    /**
     * Join a specific chat room
     */
    socket.on('join:chat', ({ chatUserId }) => {
      const roomId = [socket.userId, chatUserId].sort().join('-');
      socket.join(roomId);
      console.log(`User ${socket.userId} joined chat room: ${roomId}`);
    });

    /**
     * Leave a chat room
     */
    socket.on('leave:chat', ({ chatUserId }) => {
      const roomId = [socket.userId, chatUserId].sort().join('-');
      socket.leave(roomId);
      console.log(`User ${socket.userId} left chat room: ${roomId}`);
    });

    /**
     * Send a chat message
     * Supports both text and image messages
     */
    socket.on('chat:message', async (data) => {
      try {
        const { to, content, image_url } = data;
        
        if (!to) {
          return socket.emit('error', { message: 'Recipient required' });
        }

        // Create message in database
        const message = await Message.create({
          from: socket.userId,
          to,
          content: content || '',
          image_url: image_url || '',
          read_by: [socket.userId] // Sender has automatically read it
        });

        // Populate sender and recipient info
        await message.populate('from', 'display_name avatar_url');
        await message.populate('to', 'display_name avatar_url');

        const roomId = [socket.userId, to].sort().join('-');
        
        // Emit to room (sender and recipient if online)
        io.to(roomId).emit('chat:message', message);

        // Also emit directly to recipient if they're online but not in room
        if (onlineUsers.has(to)) {
          const recipientSockets = onlineUsers.get(to);
          recipientSockets.forEach(socketId => {
            io.to(socketId).emit('chat:message', message);
          });
        }
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * Handle typing indicator
     */
    socket.on('typing', ({ to, isTyping }) => {
      if (onlineUsers.has(to)) {
        const recipientSockets = onlineUsers.get(to);
        recipientSockets.forEach(socketId => {
          io.to(socketId).emit('typing', {
            from: socket.userId,
            isTyping
          });
        });
      }
    });

    /**
     * Mark message as read
     * Updates read_by array and notifies sender
     */
    socket.on('message:read', async (data) => {
      try {
        const { messageId } = data;
        
        if (!messageId) {
          return;
        }

        // Update message to add current user to read_by if not already there
        const message = await Message.findByIdAndUpdate(
          messageId,
          { $addToSet: { read_by: socket.userId } },
          { new: true }
        );

        if (message) {
          // Notify the sender that message was read
          const senderId = message.from.toString();
          if (onlineUsers.has(senderId)) {
            const senderSockets = onlineUsers.get(senderId);
            senderSockets.forEach(socketId => {
              io.to(socketId).emit('message:read', {
                messageId: message._id,
                readBy: socket.userId
              });
            });
          }
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    /**
     * Handle disconnect
     */
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
      
      // Remove socket from online users
      if (onlineUsers.has(socket.userId)) {
        const userSockets = onlineUsers.get(socket.userId);
        userSockets.delete(socket.id);
        
        // If user has no more sockets, remove from map and broadcast offline
        if (userSockets.size === 0) {
          onlineUsers.delete(socket.userId);
          socket.broadcast.emit('user:offline', { userId: socket.userId });
        }
      }
    });
  });

  console.log('✅ Socket.IO initialized');
};

/**
 * Get list of online user IDs
 */
export const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};
