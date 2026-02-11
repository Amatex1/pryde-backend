import mongoose from 'mongoose';

let connectionPromise = null;
let isConnected = false;

export async function connectDB(uri) {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
  }

  await connectionPromise;
  isConnected = true;

  console.log('✅ MongoDB connected via dbManager');
  return mongoose.connection;
}

// 🔒 Only allow disconnect when explicitly allowed (CLI mode)
export async function disconnectDB({ allowDisconnect = false } = {}) {
  if (!allowDisconnect) {
    console.warn('⚠️ Attempted disconnect blocked (server-owned connection)');
    return;
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    connectionPromise = null;
    console.log('🔌 MongoDB disconnected via dbManager');
  }
}

export function isDBReady() {
  return mongoose.connection.readyState === 1;
}
