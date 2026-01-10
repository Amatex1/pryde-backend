import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Import all models
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Message from '../models/Message.js';
import GlobalMessage from '../models/GlobalMessage.js';
import Conversation from '../models/Conversation.js';
import Notification from '../models/Notification.js';
import FriendRequest from '../models/FriendRequest.js';
import FollowRequest from '../models/FollowRequest.js';
import GroupChat from '../models/GroupChat.js';
import Group from '../models/Group.js';
import Circle from '../models/Circle.js';
import CircleMember from '../models/CircleMember.js';
import Block from '../models/Block.js';
import Report from '../models/Report.js';
import SecurityLog from '../models/SecurityLog.js';
import Badge from '../models/Badge.js';
import BadgeAssignmentLog from '../models/BadgeAssignmentLog.js';
import Event from '../models/Event.js';
import Journal from '../models/Journal.js';
import PhotoEssay from '../models/PhotoEssay.js';
import Longform from '../models/Longform.js';
import Collection from '../models/Collection.js';
import CollectionItem from '../models/CollectionItem.js';
import Draft from '../models/Draft.js';
import TempMedia from '../models/TempMedia.js';
import LoginApproval from '../models/LoginApproval.js';
import ModerationSettings from '../models/ModerationSettings.js';
import Reaction from '../models/Reaction.js';
import Resonance from '../models/Resonance.js';
import Tag from '../models/Tag.js';
import TagGroupMapping from '../models/TagGroupMapping.js';
import Invite from '../models/Invite.js';
import BugReport from '../models/BugReport.js';
import ReflectionPrompt from '../models/ReflectionPrompt.js';
import SystemConfig from '../models/SystemConfig.js';
import SystemPrompt from '../models/SystemPrompt.js';

const models = {
  User, Post, Comment, Message, GlobalMessage, Conversation, Notification,
  FriendRequest, FollowRequest, GroupChat, Group, Circle, CircleMember,
  Block, Report, SecurityLog, Badge, BadgeAssignmentLog, Event, Journal,
  PhotoEssay, Longform, Collection, CollectionItem, Draft, TempMedia,
  LoginApproval, ModerationSettings, Reaction, Resonance, Tag, TagGroupMapping,
  Invite, BugReport, ReflectionPrompt, SystemConfig, SystemPrompt
};

// Scoring system
const scores = {
  database: { total: 0, max: 100 },
  backend: { total: 0, max: 100 },
  frontend: { total: 0, max: 100 }
};

async function auditDatabase() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 DATABASE AUDIT');
  console.log('='.repeat(80) + '\n');
  
  let score = 0;
  const issues = [];
  const successes = [];
  
  // 1. Check indexes (30 points)
  console.log('🔍 Checking indexes...\n');
  let indexScore = 0;
  
  for (const [modelName, Model] of Object.entries(models)) {
    try {
      const collection = Model.collection;
      const indexes = await collection.indexes();
      
      if (indexes.length > 1) { // More than just _id index
        indexScore += 1;
        successes.push(`✅ ${modelName}: ${indexes.length} indexes`);
      } else {
        issues.push(`⚠️ ${modelName}: Only default _id index`);
      }
    } catch (error) {
      issues.push(`❌ ${modelName}: Error checking indexes - ${error.message}`);
    }
  }
  
  const indexPercentage = (indexScore / Object.keys(models).length) * 30;
  score += indexPercentage;
  console.log(`   Index Coverage: ${indexScore}/${Object.keys(models).length} collections (${indexPercentage.toFixed(1)}/30 points)\n`);
  
  // 2. Check data integrity (20 points)
  console.log('🔒 Checking data integrity...\n');
  let integrityScore = 20;
  
  try {
    // Check for orphaned data
    const orphanedPosts = await Post.countDocuments({ author: null });
    const orphanedComments = await Comment.countDocuments({ authorId: null });
    const orphanedMessages = await Message.countDocuments({ sender: null });
    
    if (orphanedPosts > 0) {
      issues.push(`⚠️ Found ${orphanedPosts} orphaned posts`);
      integrityScore -= 5;
    } else {
      successes.push('✅ No orphaned posts');
    }
    
    if (orphanedComments > 0) {
      issues.push(`⚠️ Found ${orphanedComments} orphaned comments`);
      integrityScore -= 5;
    } else {
      successes.push('✅ No orphaned comments');
    }
    
    if (orphanedMessages > 0) {
      issues.push(`⚠️ Found ${orphanedMessages} orphaned messages`);
      integrityScore -= 5;
    } else {
      successes.push('✅ No orphaned messages');
    }
    
    score += integrityScore;
    console.log(`   Data Integrity: ${integrityScore}/20 points\n`);
    
  } catch (error) {
    issues.push(`❌ Error checking data integrity: ${error.message}`);
    console.log(`   Data Integrity: 0/20 points (error)\n`);
  }
  
  // 3. Check performance (30 points)
  console.log('⚡ Checking performance...\n');
  let perfScore = 30;
  
  try {
    // Check for slow queries
    const db = mongoose.connection.db;
    const adminDb = db.admin();
    
    try {
      const currentOps = await adminDb.command({ currentOp: 1 });
      const slowOps = currentOps.inprog.filter(op => op.secs_running > 1 && op.op !== 'none');
      
      if (slowOps.length > 0) {
        issues.push(`⚠️ Found ${slowOps.length} slow queries`);
        perfScore -= 10;
      } else {
        successes.push('✅ No slow queries detected');
      }
    } catch (error) {
      console.log('   ⚠️ Cannot check slow queries (requires admin privileges)');
    }

    // Check collection sizes
    const stats = await Post.collection.stats();
    const avgDocSize = stats.avgObjSize || 0;

    if (avgDocSize > 100000) { // 100KB average
      issues.push(`⚠️ Large average document size: ${(avgDocSize / 1024).toFixed(2)} KB`);
      perfScore -= 10;
    } else {
      successes.push(`✅ Reasonable document size: ${(avgDocSize / 1024).toFixed(2)} KB`);
    }

    score += perfScore;
    console.log(`   Performance: ${perfScore}/30 points\n`);

  } catch (error) {
    issues.push(`❌ Error checking performance: ${error.message}`);
    console.log(`   Performance: 0/30 points (error)\n`);
  }

  // 4. Check data cleanliness (20 points)
  console.log('🧹 Checking data cleanliness...\n');
  let cleanScore = 20;

  try {
    // Check for old deleted data
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const oldNotifications = await Notification.countDocuments({
      createdAt: { $lt: ninetyDaysAgo },
      read: true
    });

    const oldDeletedMessages = await GlobalMessage.countDocuments({
      isDeleted: true,
      deletedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    if (oldNotifications > 100) {
      issues.push(`⚠️ ${oldNotifications} old read notifications (>90 days)`);
      cleanScore -= 5;
    } else {
      successes.push(`✅ Clean notifications: ${oldNotifications} old`);
    }

    if (oldDeletedMessages > 50) {
      issues.push(`⚠️ ${oldDeletedMessages} old deleted messages (>30 days)`);
      cleanScore -= 5;
    } else {
      successes.push(`✅ Clean messages: ${oldDeletedMessages} old deleted`);
    }

    score += cleanScore;
    console.log(`   Data Cleanliness: ${cleanScore}/20 points\n`);

  } catch (error) {
    issues.push(`❌ Error checking data cleanliness: ${error.message}`);
    console.log(`   Data Cleanliness: 0/20 points (error)\n`);
  }

  scores.database.total = Math.round(score);

  return { score: scores.database.total, issues, successes };
}

async function auditBackend() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 BACKEND AUDIT');
  console.log('='.repeat(80) + '\n');

  let score = 0;
  const issues = [];
  const successes = [];

  // 1. Check routes (30 points)
  console.log('🛣️ Checking routes...\n');
  let routeScore = 30;

  try {
    const routesDir = path.join(__dirname, '../routes');
    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

    console.log(`   Found ${routeFiles.length} route files`);
    successes.push(`✅ ${routeFiles.length} route files organized`);

    // Check for common security patterns
    let hasAuth = 0;
    let hasValidation = 0;

    for (const file of routeFiles) {
      const content = fs.readFileSync(path.join(routesDir, file), 'utf8');

      if (content.includes('auth') || content.includes('authenticate')) {
        hasAuth++;
      }

      if (content.includes('validate') || content.includes('check(')) {
        hasValidation++;
      }
    }

    const authPercentage = (hasAuth / routeFiles.length) * 100;
    if (authPercentage > 80) {
      successes.push(`✅ ${authPercentage.toFixed(0)}% routes have authentication`);
    } else {
      issues.push(`⚠️ Only ${authPercentage.toFixed(0)}% routes have authentication`);
      routeScore -= 10;
    }

    score += routeScore;
    console.log(`   Routes: ${routeScore}/30 points\n`);

  } catch (error) {
    issues.push(`❌ Error checking routes: ${error.message}`);
    console.log(`   Routes: 0/30 points (error)\n`);
  }

  // 2. Check middleware (20 points)
  console.log('🛡️ Checking middleware...\n');
  let middlewareScore = 20;

  try {
    const middlewareDir = path.join(__dirname, '../middleware');

    if (fs.existsSync(middlewareDir)) {
      const middlewareFiles = fs.readdirSync(middlewareDir).filter(f => f.endsWith('.js'));

      const requiredMiddleware = ['auth.js', 'rateLimiter.js', 'errorHandler.js'];
      const foundMiddleware = requiredMiddleware.filter(m => middlewareFiles.includes(m));

      if (foundMiddleware.length === requiredMiddleware.length) {
        successes.push(`✅ All required middleware present (${foundMiddleware.length}/${requiredMiddleware.length})`);
      } else {
        issues.push(`⚠️ Missing middleware: ${requiredMiddleware.filter(m => !foundMiddleware.includes(m)).join(', ')}`);
        middlewareScore -= 10;
      }
    } else {
      issues.push('❌ Middleware directory not found');
      middlewareScore = 0;
    }

    score += middlewareScore;
    console.log(`   Middleware: ${middlewareScore}/20 points\n`);

  } catch (error) {
    issues.push(`❌ Error checking middleware: ${error.message}`);
    console.log(`   Middleware: 0/20 points (error)\n`);
  }

  // 3. Check models (20 points)
  console.log('📦 Checking models...\n');
  let modelScore = 20;

  try {
    const modelsDir = path.join(__dirname, '../models');
    const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));

    console.log(`   Found ${modelFiles.length} model files`);
    successes.push(`✅ ${modelFiles.length} models defined`);

    // Check if models match imported models
    if (modelFiles.length >= Object.keys(models).length) {
      successes.push(`✅ All models properly imported`);
    } else {
      issues.push(`⚠️ Some models may not be imported`);
      modelScore -= 5;
    }

    score += modelScore;
    console.log(`   Models: ${modelScore}/20 points\n`);

  } catch (error) {
    issues.push(`❌ Error checking models: ${error.message}`);
    console.log(`   Models: 0/20 points (error)\n`);
  }

  // 4. Check error handling (15 points)
  console.log('🚨 Checking error handling...\n');
  let errorScore = 15;

  try {
    const serverFile = path.join(__dirname, '../server.js');
    const serverContent = fs.readFileSync(serverFile, 'utf8');

    if (serverContent.includes('try') && serverContent.includes('catch')) {
      successes.push('✅ Error handling present in server.js');
    } else {
      issues.push('⚠️ Limited error handling in server.js');
      errorScore -= 5;
    }

    if (serverContent.includes('process.on') && serverContent.includes('uncaughtException')) {
      successes.push('✅ Global error handlers configured');
    } else {
      issues.push('⚠️ Missing global error handlers');
      errorScore -= 5;
    }

    score += errorScore;
    console.log(`   Error Handling: ${errorScore}/15 points\n`);

  } catch (error) {
    issues.push(`❌ Error checking error handling: ${error.message}`);
    console.log(`   Error Handling: 0/15 points (error)\n`);
  }

  // 5. Check security (15 points)
  console.log('🔒 Checking security...\n');
  let securityScore = 15;

  try {
    const serverFile = path.join(__dirname, '../server.js');
    const serverContent = fs.readFileSync(serverFile, 'utf8');

    const securityFeatures = [
      { name: 'helmet', pattern: /helmet/i },
      { name: 'cors', pattern: /cors/i },
      { name: 'rate limiting', pattern: /rateLimit|limiter/i },
      { name: 'input validation', pattern: /validator|sanitize/i }
    ];

    let foundFeatures = 0;
    for (const feature of securityFeatures) {
      if (feature.pattern.test(serverContent)) {
        foundFeatures++;
        successes.push(`✅ ${feature.name} configured`);
      } else {
        issues.push(`⚠️ ${feature.name} not found`);
      }
    }

    securityScore = Math.round((foundFeatures / securityFeatures.length) * 15);
    score += securityScore;
    console.log(`   Security: ${securityScore}/15 points\n`);

  } catch (error) {
    issues.push(`❌ Error checking security: ${error.message}`);
    console.log(`   Security: 0/15 points (error)\n`);
  }

  scores.backend.total = Math.round(score);

  return { score: scores.backend.total, issues, successes };
}

async function auditFrontend() {
  console.log('\n' + '='.repeat(80));
  console.log('⚛️ FRONTEND AUDIT');
  console.log('='.repeat(80) + '\n');

  let score = 0;
  const issues = [];
  const successes = [];

  // 1. Check components (30 points)
  console.log('🧩 Checking components...\n');
  let componentScore = 30;

  try {
    // Try multiple possible frontend paths
    const possiblePaths = [
      path.join(__dirname, '../../pryde-frontend/src'),
      path.join(__dirname, '../../../pryde-frontend/src'),
      'F:/Desktop/pryde-frontend/src'
    ];

    let frontendDir = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        frontendDir = p;
        break;
      }
    }

    if (frontendDir) {
      const pagesDir = path.join(frontendDir, 'pages');
      const componentsDir = path.join(frontendDir, 'components');

      let pageCount = 0;
      let componentCount = 0;

      if (fs.existsSync(pagesDir)) {
        pageCount = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx') || f.endsWith('.js')).length;
      }

      if (fs.existsSync(componentsDir)) {
        componentCount = fs.readdirSync(componentsDir).filter(f => f.endsWith('.jsx') || f.endsWith('.js')).length;
      }

      console.log(`   Found ${pageCount} pages and ${componentCount} components`);
      successes.push(`✅ ${pageCount} pages organized`);
      successes.push(`✅ ${componentCount} reusable components`);

      if (pageCount > 10 && componentCount > 5) {
        successes.push('✅ Good component organization');
      } else {
        issues.push('⚠️ Limited component structure');
        componentScore -= 10;
      }
    } else {
      issues.push('❌ Frontend directory not found');
      componentScore = 0;
    }

    score += componentScore;
    console.log(`   Components: ${componentScore}/30 points\n`);

  } catch (error) {
    issues.push(`❌ Error checking components: ${error.message}`);
    console.log(`   Components: 0/30 points (error)\n`);
  }

  // 2. Check routing (20 points)
  console.log('🛣️ Checking routing...\n');
  let routingScore = 20;

  try {
    const possiblePaths = [
      path.join(__dirname, '../../pryde-frontend/src/App.jsx'),
      path.join(__dirname, '../../../pryde-frontend/src/App.jsx'),
      'F:/Desktop/pryde-frontend/src/App.jsx'
    ];

    let appFile = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        appFile = p;
        break;
      }
    }

    if (appFile) {
      const appContent = fs.readFileSync(appFile, 'utf8');

      if (appContent.includes('BrowserRouter') || appContent.includes('Router')) {
        successes.push('✅ React Router configured');
      } else {
        issues.push('⚠️ React Router not found');
        routingScore -= 10;
      }

      const routeCount = (appContent.match(/<Route/g) || []).length;
      console.log(`   Found ${routeCount} routes`);

      if (routeCount > 10) {
        successes.push(`✅ ${routeCount} routes defined`);
      } else {
        issues.push(`⚠️ Only ${routeCount} routes defined`);
        routingScore -= 5;
      }
    } else {
      issues.push('❌ App.jsx not found');
      routingScore = 0;
    }

    score += routingScore;
    console.log(`   Routing: ${routingScore}/20 points\n`);

  } catch (error) {
    issues.push(`❌ Error checking routing: ${error.message}`);
    console.log(`   Routing: 0/20 points (error)\n`);
  }

  // 3. Check state management (20 points)
  console.log('🗂️ Checking state management...\n');
  let stateScore = 20;

  try {
    const possiblePaths = [
      path.join(__dirname, '../../pryde-frontend/src/context'),
      path.join(__dirname, '../../../pryde-frontend/src/context'),
      'F:/Desktop/pryde-frontend/src/context'
    ];

    let contextDir = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        contextDir = p;
        break;
      }
    }

    if (contextDir) {
      const contextFiles = fs.readdirSync(contextDir).filter(f => f.endsWith('.jsx') || f.endsWith('.js'));

      console.log(`   Found ${contextFiles.length} context providers`);

      if (contextFiles.length > 0) {
        successes.push(`✅ ${contextFiles.length} context providers for state management`);
      } else {
        issues.push('⚠️ No context providers found');
        stateScore -= 10;
      }
    } else {
      issues.push('⚠️ No context directory found');
      stateScore -= 10;
    }

    score += stateScore;
    console.log(`   State Management: ${stateScore}/20 points\n`);

  } catch (error) {
    issues.push(`❌ Error checking state management: ${error.message}`);
    console.log(`   State Management: 0/20 points (error)\n`);
  }

  // 4. Check styling (15 points)
  console.log('🎨 Checking styling...\n');
  let styleScore = 15;

  try {
    const possiblePaths = [
      path.join(__dirname, '../../pryde-frontend/src/styles'),
      path.join(__dirname, '../../../pryde-frontend/src/styles'),
      'F:/Desktop/pryde-frontend/src/styles'
    ];

    let stylesDir = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        stylesDir = p;
        break;
      }
    }

    if (stylesDir) {
      const styleFiles = fs.readdirSync(stylesDir).filter(f => f.endsWith('.css') || f.endsWith('.scss'));

      console.log(`   Found ${styleFiles.length} style files`);

      if (styleFiles.length > 0) {
        successes.push(`✅ ${styleFiles.length} organized style files`);
      } else {
        issues.push('⚠️ No style files found');
        styleScore -= 10;
      }
    } else {
      issues.push('⚠️ No styles directory found');
      styleScore -= 10;
    }

    score += styleScore;
    console.log(`   Styling: ${styleScore}/15 points\n`);

  } catch (error) {
    issues.push(`❌ Error checking styling: ${error.message}`);
    console.log(`   Styling: 0/15 points (error)\n`);
  }

  // 5. Check build configuration (15 points)
  console.log('⚙️ Checking build configuration...\n');
  let buildScore = 15;

  try {
    const possiblePaths = [
      path.join(__dirname, '../../pryde-frontend/package.json'),
      path.join(__dirname, '../../../pryde-frontend/package.json'),
      'F:/Desktop/pryde-frontend/package.json'
    ];

    let packageFile = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        packageFile = p;
        break;
      }
    }

    if (packageFile) {
      const packageContent = JSON.parse(fs.readFileSync(packageFile, 'utf8'));

      if (packageContent.scripts && packageContent.scripts.build) {
        successes.push('✅ Build script configured');
      } else {
        issues.push('⚠️ No build script found');
        buildScore -= 5;
      }

      if (packageContent.dependencies) {
        const depCount = Object.keys(packageContent.dependencies).length;
        console.log(`   Found ${depCount} dependencies`);
        successes.push(`✅ ${depCount} dependencies managed`);
      }
    } else {
      issues.push('❌ package.json not found');
      buildScore = 0;
    }

    score += buildScore;
    console.log(`   Build Configuration: ${buildScore}/15 points\n`);

  } catch (error) {
    issues.push(`❌ Error checking build configuration: ${error.message}`);
    console.log(`   Build Configuration: 0/15 points (error)\n`);
  }

  scores.frontend.total = Math.round(score);

  return { score: scores.frontend.total, issues, successes };
}

function generateFinalReport(dbResult, beResult, feResult) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 COMPREHENSIVE AUDIT REPORT');
  console.log('='.repeat(80) + '\n');

  // Overall scores
  console.log('🏆 OVERALL SCORES:\n');
  console.log(`   📊 Database:  ${dbResult.score}/100 ${getGrade(dbResult.score)}`);
  console.log(`   🔧 Backend:   ${beResult.score}/100 ${getGrade(beResult.score)}`);
  console.log(`   ⚛️ Frontend:  ${feResult.score}/100 ${getGrade(feResult.score)}`);

  const totalScore = Math.round((dbResult.score + beResult.score + feResult.score) / 3);
  console.log(`\n   🎯 TOTAL:     ${totalScore}/100 ${getGrade(totalScore)}\n`);

  // Grade interpretation
  console.log('📊 GRADE INTERPRETATION:\n');
  console.log('   A+ (95-100): Excellent - Production ready');
  console.log('   A  (90-94):  Very Good - Minor improvements needed');
  console.log('   B+ (85-89):  Good - Some optimizations recommended');
  console.log('   B  (80-84):  Satisfactory - Several improvements needed');
  console.log('   C+ (75-79):  Fair - Significant improvements needed');
  console.log('   C  (70-74):  Needs Work - Major improvements required');
  console.log('   D  (60-69):  Poor - Critical issues to address');
  console.log('   F  (<60):    Failing - Immediate action required\n');

  // Detailed issues
  if (dbResult.issues.length > 0 || beResult.issues.length > 0 || feResult.issues.length > 0) {
    console.log('⚠️ ISSUES FOUND:\n');

    if (dbResult.issues.length > 0) {
      console.log('   📊 Database:');
      dbResult.issues.forEach(issue => console.log(`      ${issue}`));
      console.log();
    }

    if (beResult.issues.length > 0) {
      console.log('   🔧 Backend:');
      beResult.issues.forEach(issue => console.log(`      ${issue}`));
      console.log();
    }

    if (feResult.issues.length > 0) {
      console.log('   ⚛️ Frontend:');
      feResult.issues.forEach(issue => console.log(`      ${issue}`));
      console.log();
    }
  }

  // Successes
  console.log('✅ SUCCESSES:\n');
  console.log(`   📊 Database: ${dbResult.successes.length} items`);
  console.log(`   🔧 Backend: ${beResult.successes.length} items`);
  console.log(`   ⚛️ Frontend: ${feResult.successes.length} items\n`);

  console.log('='.repeat(80) + '\n');
}

function getGrade(score) {
  if (score >= 95) return '(A+)';
  if (score >= 90) return '(A)';
  if (score >= 85) return '(B+)';
  if (score >= 80) return '(B)';
  if (score >= 75) return '(C+)';
  if (score >= 70) return '(C)';
  if (score >= 60) return '(D)';
  return '(F)';
}

async function main() {
  try {
    const mongoURL = process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI;

    if (!mongoURL) {
      console.error('❌ No MongoDB connection string found in environment variables');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...\n');
    await mongoose.connect(mongoURL);
    console.log('✅ Connected to MongoDB!\n');

    // Run all audits
    const dbResult = await auditDatabase();
    const beResult = await auditBackend();
    const feResult = await auditFrontend();

    // Generate final report
    generateFinalReport(dbResult, beResult, feResult);

    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

