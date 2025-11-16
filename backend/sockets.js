import jwt from 'jsonwebtoken';
import Message from './models/Message.js';
import User from './models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secret_dev_key';

// Map to track online users: userId -> socketId
const onlineUsers = new Map();

export const setupSockets = (io) => {
  io.use((socket, next) => {
    // Authenticate socket connection
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);
    
    // Add user to online users map
    onlineUsers.set(socket.userId.toString(), socket.id);
    
    // Broadcast user online status
    socket.broadcast.emit('user:online', { userId: socket.userId });

    // Handle chat message
    socket.on('chat:message', async (data) => {
      try {
        const { to, content, image_url } = data;
        
        // Create and save message
        const message = await Message.create({
          from: socket.userId,
          to,
          content: content || null,
          image_url: image_url || null,
          read_by: [socket.userId] // Sender has read it
        });

        // Populate sender info
        const populatedMessage = await Message.findById(message._id)
          .populate('from', 'display_name avatar_url')
          .populate('to', 'display_name avatar_url')
          .lean();

        // Send to recipient if online
        const recipientSocketId = onlineUsers.get(to.toString());
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('chat:message', populatedMessage);
        }

        // Send back to sender
        socket.emit('chat:message', populatedMessage);
      } catch (error) {
        console.error('Error handling chat:message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message read receipt
    socket.on('message:read', async (data) => {
      try {
        const { messageIds } = data;
        
        // Update read_by for multiple messages
        await Message.updateMany(
          { _id: { $in: messageIds }, to: socket.userId },
          { $addToSet: { read_by: socket.userId } }
        );

        // Notify the sender(s) that messages were read
        const messages = await Message.find({ _id: { $in: messageIds } }).lean();
        const senderIds = [...new Set(messages.map(m => m.from.toString()))];
        
        senderIds.forEach(senderId => {
          const senderSocketId = onlineUsers.get(senderId);
          if (senderSocketId) {
            io.to(senderSocketId).emit('message:read', { 
              messageIds, 
              readBy: socket.userId 
            });
          }
        });
      } catch (error) {
        console.error('Error handling message:read:', error);
      }
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      const { to, isTyping } = data;
      const recipientSocketId = onlineUsers.get(to.toString());
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('typing', { 
          from: socket.userId, 
          isTyping 
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      onlineUsers.delete(socket.userId.toString());
      socket.broadcast.emit('user:offline', { userId: socket.userId });
    });
  });
};
