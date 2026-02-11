import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '../utils/dbManager.js';
import cleanupOldData from '../scripts/cleanupOldData.js';
import config from '../config/config.js';

async function run() {
  await connectDB(config.mongoURI);
  await cleanupOldData();
  await disconnectDB({ allowDisconnect: true });
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
