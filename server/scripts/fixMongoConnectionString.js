/**
 * MongoDB Connection String Helper
 * Helps fix common connection string issues
 */

console.log('🔧 MongoDB Connection String Helper\n');
console.log('This tool will help you fix your MongoDB connection string.\n');

// Get current connection string from .env
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const currentURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;

if (!currentURL) {
  console.error('❌ No MongoDB connection string found in .env file');
  process.exit(1);
}

console.log('📋 Current Connection String:');
const maskedURL = currentURL.replace(/:([^:@]+)@/, ':****@');
console.log(`   ${maskedURL}\n`);

// Parse the connection string
const urlPattern = /mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)(\?.*)?/;
const match = currentURL.match(urlPattern);

if (!match) {
  console.error('❌ Could not parse connection string');
  console.error('   Expected format: mongodb+srv://username:password@host/database?options');
  process.exit(1);
}

const [, username, password, host, database, options] = match;

console.log('🔍 Parsed Components:');
console.log(`   Username: ${username}`);
console.log(`   Password: ${password.replace(/./g, '*')}`);
console.log(`   Host: ${host}`);
console.log(`   Database: ${database}`);
console.log(`   Options: ${options || 'none'}\n`);

// Check if password needs encoding
const needsEncoding = /[^a-zA-Z0-9\-._~]/.test(password);

if (needsEncoding) {
  console.log('⚠️  Your password contains special characters that need URL encoding!\n');
  console.log('   Current password: ' + password.replace(/./g, '*'));
  console.log('   Encoded password: ' + encodeURIComponent(password).replace(/./g, '*'));
  console.log();
  
  const encodedPassword = encodeURIComponent(password);
  const fixedURL = `mongodb+srv://${username}:${encodedPassword}@${host}/${database}${options || ''}`;
  
  console.log('✅ Fixed Connection String:');
  console.log(`   ${fixedURL.replace(/:([^:@]+)@/, ':****@')}\n`);
  console.log('📝 Update your .env file with:');
  console.log(`   MONGO_URI=${fixedURL}\n`);
} else {
  console.log('✅ Password does not need URL encoding\n');
}

// Suggest alternative authSource values
console.log('💡 Common Issues & Solutions:\n');

console.log('1. Wrong authSource:');
console.log('   Try these connection strings:\n');

const authSources = ['admin', database, 'test'];
authSources.forEach(authSource => {
  const testURL = currentURL.includes('authSource=')
    ? currentURL.replace(/authSource=[^&]+/, `authSource=${authSource}`)
    : currentURL + (currentURL.includes('?') ? '&' : '?') + `authSource=${authSource}`;
  
  console.log(`   authSource=${authSource}:`);
  console.log(`   ${testURL.replace(/:([^:@]+)@/, ':****@')}\n`);
});

console.log('2. User created in wrong database:');
console.log('   - Go to MongoDB Atlas → Database Access');
console.log('   - Check which database the user has access to');
console.log('   - Make sure the user has "readWrite" or "dbAdmin" role\n');

console.log('3. Password contains special characters:');
console.log('   - Use the encoded password shown above');
console.log('   - Or change your password to use only letters and numbers\n');

console.log('4. IP not whitelisted:');
console.log('   - Go to MongoDB Atlas → Network Access');
console.log('   - Add your current IP or 0.0.0.0/0\n');

console.log('📖 For more help, see: server/audit/TROUBLESHOOTING.md\n');

