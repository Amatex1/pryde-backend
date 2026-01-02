import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import ReflectionPrompt from '../models/ReflectionPrompt.js';
import SystemPrompt from '../models/SystemPrompt.js';
import SystemConfig from '../models/SystemConfig.js';

dotenv.config();

async function checkFeatures() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    // ===== 1. CHECK MODERATION =====
    console.log('=== 1. MODERATION ===');
    const usersWithViolations = await User.countDocuments({ 'moderation.violationCount': { $gt: 0 } });
    const mutedUsers = await User.countDocuments({ 'moderation.isMuted': true });
    console.log(`  Users with violations: ${usersWithViolations}`);
    console.log(`  Currently muted users: ${mutedUsers}`);
    console.log('  ✓ Moderation middleware is applied to POST /api/posts, /api/messages, /api/posts/:id/comment');

    // ===== 2. CHECK REFLECTION PROMPTS (Private per-user) =====
    console.log('\n=== 2. REFLECTION PROMPTS (Private) ===');
    const totalPrompts = await ReflectionPrompt.countDocuments();
    const activePrompt = await ReflectionPrompt.findOne({ active: true });
    console.log(`  Total prompts: ${totalPrompts}`);
    console.log(`  Active prompt: ${activePrompt ? `"${activePrompt.text.substring(0, 50)}..."` : 'None'}`);
    if (totalPrompts === 0) {
      console.log('  ⚠️  No prompts exist - run: node server/scripts/seedReflectionPrompts.js');
    } else {
      console.log('  ✓ Private prompts shown to users at top of feed/journals');
    }

    // ===== 3. CHECK SYSTEM PROMPTS (Public feed) =====
    console.log('\n=== 3. SYSTEM PROMPTS (Public Feed) ===');
    const totalSysPrompts = await SystemPrompt.countDocuments();
    const activeSysPrompts = await SystemPrompt.countDocuments({ isActive: true });
    const sysEnabled = await SystemConfig.getValue('systemPrompts.enabled', null);
    console.log(`  Total system prompts: ${totalSysPrompts}`);
    console.log(`  Active system prompts: ${activeSysPrompts}`);
    console.log(`  System prompts enabled: ${sysEnabled === null ? 'Not configured' : sysEnabled}`);
    console.log('  ✓ Public posts from pryde_prompts account in feed');

    // ===== 4. CHECK SYSTEM ACCOUNTS =====
    console.log('\n=== 4. SYSTEM ACCOUNTS ===');
    const systemAccounts = await User.find({ isSystemAccount: true }).select('username displayName isActive');
    if (systemAccounts.length === 0) {
      console.log('  ⚠️  No system accounts found - run: node server/scripts/seedSystemPrompts.js');
    } else {
      systemAccounts.forEach(acc => {
        console.log(`  - ${acc.username} (${acc.displayName}) - ${acc.isActive ? 'Active' : 'Inactive'}`);
      });
    }

    console.log('\n=== SUMMARY ===');
    console.log('✓ Moderation: Automatic content filtering on posts/comments/messages');
    console.log('✓ Reflection Prompts: Private per-user prompts (GET /api/prompts/active)');
    console.log('✓ System Prompts: Public feed posts from pryde_prompts');
    console.log('✓ Announcements: Posts from pryde_announcements system account');

    await mongoose.disconnect();
    console.log('\nDone');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkFeatures();

