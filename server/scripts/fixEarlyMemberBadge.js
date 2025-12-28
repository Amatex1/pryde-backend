/**
 * Fix the early_member badge that has undefined assignmentType
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

import Badge from '../models/Badge.js';

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Fix early_member badge
  const result = await Badge.updateOne(
    { id: 'early_member' },
    { 
      $set: { 
        assignmentType: 'automatic',
        automaticRule: 'early_member'
      } 
    }
  );
  console.log('Updated early_member:', result);

  // Verify all badges
  const badges = await Badge.find({}).lean();
  console.log('\nAll badges:');
  for (const b of badges) {
    console.log(`  - ${b.id}: ${b.label} (${b.assignmentType})`);
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

fix().catch(console.error);

