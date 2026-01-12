/**
 * Migration: Add metadata field to notifications
 * Created: 2026-01-12
 * 
 * Adds metadata field to existing notifications for better context
 */

import mongoose from 'mongoose';

export const up = async () => {
  console.log('Running migration: add_metadata_to_notifications');
  
  const Notification = mongoose.model('Notification');
  
  // Add metadata field to notifications that don't have it
  const result = await Notification.updateMany(
    { metadata: { $exists: false } },
    { $set: { metadata: {} } }
  );
  
  console.log(`✅ Updated ${result.modifiedCount} notifications with metadata field`);
  console.log('Migration completed: add_metadata_to_notifications');
};

export const down = async () => {
  console.log('Rolling back migration: add_metadata_to_notifications');
  
  const Notification = mongoose.model('Notification');
  
  // Remove metadata field
  const result = await Notification.updateMany(
    { metadata: { $exists: true } },
    { $unset: { metadata: '' } }
  );
  
  console.log(`✅ Removed metadata field from ${result.modifiedCount} notifications`);
  console.log('Rollback completed: add_metadata_to_notifications');
};

