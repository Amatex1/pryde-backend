import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from './models/Message.js';
import User from './models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev_key';

// Map to track online users: userId -> socketId
const onlineUsers = new Map();

/**
 * Initialize Socket.io with authentication
 */
export const initializeSockets = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.userId).lean();
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      if (user.banned) {
        return next(new Error('Authentication error: Account banned'));
      }

      // Attach userId to socket
      socket.userId = user._id.toString();
      socket.userInfo = {
        id: user._id,
        display_name: user.display_name,
        avatar_url: user.avatar_url
      };

      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);

    // Add user to online users
    onlineUsers.set(socket.userId, socket.id);

    // Broadcast online status to all users
    io.emit('user:online', { userId: socket.userId });

    /**
     * Handle chat message
     */
    socket.on('chat:message', async (data) => {
      try {
        const { to, content, image_url } = data;

        if (!to) {
          socket.emit('error', { message: 'Recipient not specified' });
          return;
        }

        if (!content && !image_url) {
          socket.emit('error', { message: 'Message must have content or image' });
          return;
        }

        // Save message to database
        const message = await Message.create({
          from: socket.userId,
          to,
          content: content || null,
          image_url: image_url || null,
          read_by: [socket.userId] // Sender has "read" their own message
        });

        // Populate sender and recipient info
        await message.populate('from', 'display_name avatar_url');
        await message.populate('to', 'display_name avatar_url');

        // Send to recipient if they're online
        const recipientSocketId = onlineUsers.get(to);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('chat:message', message);
        }

        // Send confirmation back to sender
        socket.emit('chat:message', message);

      } catch (error) {
        console.error('Chat message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * Handle message read receipts
     */
    socket.on('message:read', async (data) => {
      try {
        const { messageIds } = data;

        if (!messageIds || !Array.isArray(messageIds)) {
          return;
        }

        // Update read_by for multiple messages
        await Message.updateMany(
          {
            _id: { $in: messageIds },
            to: socket.userId,
            read_by: { $ne: socket.userId }
          },
          {
            $addToSet: { read_by: socket.userId }
          }
        );

        // Get updated messages
        const messages = await Message.find({ _id: { $in: messageIds } })
          .select('_id from to read_by')
          .lean();

        // Notify senders about read receipts
        messages.forEach(msg => {
          const senderSocketId = onlineUsers.get(msg.from.toString());
          if (senderSocketId) {
            io.to(senderSocketId).emit('message:read', {
              messageIds: [msg._id],
              readBy: socket.userId
            });
          }
        });

      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    /**
     * Handle typing indicator
     */
    socket.on('typing', (data) => {
      const { to, isTyping } = data;
      
      if (!to) return;

      const recipientSocketId = onlineUsers.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('typing', {
          from: socket.userId,
          isTyping
        });
      }
    });

    /**
     * Handle disconnect
     */
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
      
      // Remove from online users
      onlineUsers.delete(socket.userId);

      // Broadcast offline status
      io.emit('user:offline', { userId: socket.userId });
    });
  });

  return io;
};

export { onlineUsers };
