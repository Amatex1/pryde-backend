/**
 * Fix Groups Status
 * Sets status = 'approved' for all groups that don't have a status field
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixGroupStatus() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Update all groups without status to approved
    const result = await mongoose.connection.db.collection('groups').updateMany(
      { status: { $exists: false } },
      { $set: { status: 'approved' } }
    );

    console.log('Updated groups without status:', result.modifiedCount);

    // Also update any with null status
    const result2 = await mongoose.connection.db.collection('groups').updateMany(
      { status: null },
      { $set: { status: 'approved' } }
    );

    console.log('Updated groups with null status:', result2.modifiedCount);

    // Show all groups
    const allGroups = await mongoose.connection.db.collection('groups').find({}).toArray();
    console.log('\nAll groups:');
    allGroups.forEach(g => console.log(`  - ${g.name} | status: ${g.status} | visibility: ${g.visibility}`));

    await mongoose.disconnect();
    console.log('\nDone!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixGroupStatus();

