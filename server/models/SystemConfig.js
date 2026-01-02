/**
 * System Configuration Model
 * 
 * Stores global platform settings that can be toggled by admins.
 * Uses a key-value pattern for flexibility.
 * 
 * Known keys:
 * - systemPrompts.enabled: Whether daily prompt posting is active
 * - systemPrompts.lastPostedAt: When the last prompt was posted
 * - systemPrompts.frequency: How often to post (in hours, default 24)
 */

import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
  // Unique key for the configuration
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  
  // The configuration value (flexible - can be string, number, boolean, etc.)
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Human-readable description
  description: {
    type: String,
    default: ''
  },
  
  // Who last updated this config
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

/**
 * Static method to get a config value with a default fallback
 */
systemConfigSchema.statics.getValue = async function(key, defaultValue = null) {
  const config = await this.findOne({ key });
  return config ? config.value : defaultValue;
};

/**
 * Static method to set a config value (upsert)
 */
systemConfigSchema.statics.setValue = async function(key, value, userId = null, description = '') {
  return this.findOneAndUpdate(
    { key },
    {
      value,
      updatedBy: userId,
      ...(description && { description })
    },
    { upsert: true, new: true }
  );
};

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

export default SystemConfig;

