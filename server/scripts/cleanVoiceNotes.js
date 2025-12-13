import mongoose from 'mongoose';
import Message from '../models/Message.js';
import config from '../config/config.js';

/**
 * Clean up empty voiceNote objects from existing messages
 * This script removes voiceNote objects where url is null
 */

async function cleanVoiceNotes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(config.mongoURI);
    console.log('✅ Connected to MongoDB');

    console.log('🔍 Finding messages with voiceNote field...');

    // Find all messages that have a voiceNote field
    const messagesWithVoiceNote = await Message.find({
      voiceNote: { $exists: true }
    });

    console.log(`📊 Found ${messagesWithVoiceNote.length} messages with voiceNote field`);

    // Check which ones have null/empty values
    const emptyVoiceNotes = messagesWithVoiceNote.filter(msg =>
      !msg.voiceNote || !msg.voiceNote.url || msg.voiceNote.url === null
    );

    console.log(`📊 Found ${emptyVoiceNotes.length} messages with empty/null voiceNote`);

    if (emptyVoiceNotes.length === 0) {
      console.log('✅ No messages to clean up!');
      process.exit(0);
    }

    console.log('🧹 Cleaning up messages...');

    // Update all messages to remove the voiceNote field if it's empty
    const result = await Message.updateMany(
      {
        $or: [
          { 'voiceNote.url': null },
          { 'voiceNote.url': { $exists: false } },
          { voiceNote: null }
        ]
      },
      { $unset: { voiceNote: '' } }
    );

    console.log(`✅ Cleaned up ${result.modifiedCount} messages`);
    console.log('🎉 Done!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning voice notes:', error);
    process.exit(1);
  }
}

cleanVoiceNotes();

