import jwt from 'jsonwebtoken';
import Message from './models/Message.js';
import User from './models/User.js';

// Map to track online users: userId -> Set of socketIds
const onlineUsers = new Map();

/**
 * Initialize Socket.io handlers
 */
export const initSockets = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const jwtSecret = process.env.JWT_SECRET || 'secret_dev_key';
      const decoded = jwt.verify(token, jwtSecret);
      
      // Get user from database
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      if (user.banned) {
        return next(new Error('User is banned'));
      }

      // Attach user to socket
      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.user.display_name} (${socket.userId})`);

    // Add user to online users map
    if (!onlineUsers.has(socket.userId)) {
      onlineUsers.set(socket.userId, new Set());
    }
    onlineUsers.get(socket.userId).add(socket.id);

    // Broadcast user online status to all clients
    io.emit('user:online', { userId: socket.userId });

    /**
     * Handle join:chat - Join a specific chat room
     */
    socket.on('join:chat', (data) => {
      const { withUserId } = data;
      if (withUserId) {
        const roomName = [socket.userId, withUserId].sort().join('-');
        socket.join(roomName);
        console.log(`User ${socket.userId} joined chat room: ${roomName}`);
      }
    });

    /**
     * Handle leave:chat - Leave a specific chat room
     */
    socket.on('leave:chat', (data) => {
      const { withUserId } = data;
      if (withUserId) {
        const roomName = [socket.userId, withUserId].sort().join('-');
        socket.leave(roomName);
        console.log(`User ${socket.userId} left chat room: ${roomName}`);
      }
    });

    /**
     * Handle chat:message - Send a chat message
     */
    socket.on('chat:message', async (data) => {
      try {
        const { to, content, image_url } = data;

        if (!to) {
          socket.emit('error', { message: 'Recipient user ID required' });
          return;
        }

        // Create and save message
        const message = await Message.create({
          from: socket.userId,
          to,
          content: content || '',
          image_url: image_url || '',
          read_by: [socket.userId] // Sender has read it by default
        });

        // Populate sender info
        await message.populate('from', 'display_name avatar_url');
        await message.populate('to', 'display_name avatar_url');

        const roomName = [socket.userId, to].sort().join('-');
        
        // Emit to all sockets in the room (including sender)
        io.to(roomName).emit('chat:message', message);

        // Also emit directly to recipient if they're online but not in the room
        const recipientSockets = onlineUsers.get(to);
        if (recipientSockets) {
          recipientSockets.forEach(socketId => {
            io.to(socketId).emit('new:message', message);
          });
        }
      } catch (error) {
        console.error('Error handling chat:message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * Handle typing - Notify when user is typing
     */
    socket.on('typing', (data) => {
      const { to, isTyping } = data;
      if (to) {
        const recipientSockets = onlineUsers.get(to);
        if (recipientSockets) {
          recipientSockets.forEach(socketId => {
            io.to(socketId).emit('typing', {
              from: socket.userId,
              isTyping
            });
          });
        }
      }
    });

    /**
     * Handle message:read - Mark messages as read
     */
    socket.on('message:read', async (data) => {
      try {
        const { messageIds, withUserId } = data;

        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
          return;
        }

        // Update messages to add current user to read_by array
        await Message.updateMany(
          {
            _id: { $in: messageIds },
            read_by: { $ne: socket.userId }
          },
          {
            $addToSet: { read_by: socket.userId }
          }
        );

        // Notify the sender that messages were read
        if (withUserId) {
          const senderSockets = onlineUsers.get(withUserId);
          if (senderSockets) {
            senderSockets.forEach(socketId => {
              io.to(socketId).emit('message:read', {
                messageIds,
                readBy: socket.userId
              });
            });
          }
        }
      } catch (error) {
        console.error('Error handling message:read:', error);
      }
    });

    /**
     * Handle disconnect
     */
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.user.display_name} (${socket.userId})`);

      // Remove socket from online users
      if (onlineUsers.has(socket.userId)) {
        onlineUsers.get(socket.userId).delete(socket.id);
        
        // If user has no more sockets, remove from online users and broadcast offline
        if (onlineUsers.get(socket.userId).size === 0) {
          onlineUsers.delete(socket.userId);
          io.emit('user:offline', { userId: socket.userId });
        }
      }
    });
  });
};
