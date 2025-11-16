import jwt from 'jsonwebtoken';
import Message from './models/Message.js';
import User from './models/User.js';

const onlineUsers = new Map(); // userId -> socketId

export const setupSockets = (io) => {
  // Authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      
      const jwtSecret = process.env.JWT_SECRET || 'secret_dev_key';
      const decoded = jwt.verify(token, jwtSecret);
      
      const user = await User.findById(decoded.userId).lean();
      if (!user || user.banned) {
        return next(new Error('Authentication error'));
      }
      
      socket.userId = user._id.toString();
      socket.userDisplayName = user.display_name;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);
    
    // Add user to online users
    onlineUsers.set(socket.userId, socket.id);
    
    // Broadcast user online status
    io.emit('user:online', { userId: socket.userId });

    // Handle chat messages
    socket.on('chat:message', async (data) => {
      try {
        const { to, content, image_url } = data;
        
        if (!to || (!content && !image_url)) {
          return socket.emit('error', { message: 'Invalid message data' });
        }
        
        // Create message in database
        const message = await Message.create({
          from: socket.userId,
          to,
          content,
          image_url,
          read_by: [socket.userId]
        });
        
        // Populate sender and recipient info
        await message.populate('from', 'display_name avatar_url');
        await message.populate('to', 'display_name avatar_url');
        
        // Send to recipient if online
        const recipientSocketId = onlineUsers.get(to);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('chat:message', message);
        }
        
        // Send confirmation to sender
        socket.emit('chat:message', message);
        
      } catch (error) {
        console.error('Chat message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message read receipts
    socket.on('message:read', async (data) => {
      try {
        const { messageIds, otherUserId } = data;
        
        if (!messageIds || !Array.isArray(messageIds)) {
          return;
        }
        
        // Update messages to mark as read
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
        
        // Notify the other user
        const otherSocketId = onlineUsers.get(otherUserId);
        if (otherSocketId) {
          io.to(otherSocketId).emit('message:read', {
            messageIds,
            readBy: socket.userId
          });
        }
        
      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      const { to, isTyping } = data;
      const recipientSocketId = onlineUsers.get(to);
      
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('typing', {
          from: socket.userId,
          isTyping
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
      onlineUsers.delete(socket.userId);
      
      // Broadcast user offline status
      io.emit('user:offline', { userId: socket.userId });
    });
  });
};

export const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};
