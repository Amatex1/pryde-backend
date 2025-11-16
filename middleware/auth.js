import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN
    if (!token) {
      return res.status(403).json({ error: "Not authenticated" });
    }
    
    const jwtSecret = process.env.JWT_SECRET || 'secret_dev_key';
    const decoded = jwt.verify(token, jwtSecret);
    
    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      return res.status(403).json({ error: "User not found" });
    }
    
    if (user.banned) {
      return res.status(403).json({ error: "User is banned" });
    }
    
    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid token" });
  }
};