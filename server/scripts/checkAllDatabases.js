import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkAllDatabases() {
  try {
    const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;
    
    if (!mongoURL) {
      console.error('❌ No MongoDB connection string found');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURL);
    console.log('✅ Connected!\n');

    // Get the current database name
    const currentDB = mongoose.connection.db.databaseName;
    console.log('📊 Current Database:', currentDB);
    console.log();

    // List all databases
    console.log('📚 All Databases:');
    const adminDb = mongoose.connection.db.admin();
    const { databases } = await adminDb.listDatabases();
    
    for (const db of databases) {
      console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    }
    console.log();

    // Check user count in each database that might have users
    console.log('👥 User Counts by Database:');
    
    for (const db of databases) {
      if (db.name === 'admin' || db.name === 'local' || db.name === 'config') {
        continue; // Skip system databases
      }
      
      try {
        const dbConnection = mongoose.connection.client.db(db.name);
        const collections = await dbConnection.listCollections().toArray();
        const hasUsers = collections.some(c => c.name === 'users');
        
        if (hasUsers) {
          const userCount = await dbConnection.collection('users').countDocuments({});
          console.log(`   ${db.name}: ${userCount} users ${db.name === currentDB ? '← CURRENT' : ''}`);
        }
      } catch (error) {
        console.log(`   ${db.name}: Error checking (${error.message})`);
      }
    }

    console.log();
    console.log('🔍 Connection String Analysis:');
    const urlPattern = /mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]*)/;
    const match = mongoURL.match(urlPattern);
    
    if (match) {
      const [, username, , host, dbName] = match;
      console.log(`   Host: ${host}`);
      console.log(`   Database in URL: "${dbName}" ${dbName === '' ? '(EMPTY - defaults to "test")' : ''}`);
      console.log(`   Actual database: "${currentDB}"`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Check completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAllDatabases();

