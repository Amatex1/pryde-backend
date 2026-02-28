import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fail fast on startup if BACKUP_API_KEY is not configured in production
if (!process.env.BACKUP_API_KEY) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BACKUP_API_KEY must be set in production. Refusing to start with backup route unprotected.');
  } else {
    console.warn('[backup] WARNING: BACKUP_API_KEY is not set. Backup routes will return 503 until configured.');
  }
}

const safeCompare = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Still run a comparison to prevent timing leak on length
    crypto.timingSafeEqual(bufA.slice(0, 1), bufA.slice(0, 1));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
};

// API key authentication middleware — header only, no query param to avoid log exposure
const apiKeyAuth = (req, res, next) => {
  if (!process.env.BACKUP_API_KEY) {
    return res.status(503).json({ success: false, message: 'Backup service is not configured' });
  }
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Missing API key' });
  }
  if (!safeCompare(apiKey, process.env.BACKUP_API_KEY)) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid API key' });
  }
  next();
};

// @route   GET /api/backup/download
// @desc    Download the latest backup file
// @access  Private (API Key required)
router.get('/download', apiKeyAuth, async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '../backups');
    const latestBackupPath = path.join(backupDir, 'full-backup-latest.json');
    
    // Check if backup directory exists
    if (!fs.existsSync(backupDir)) {
      return res.status(404).json({ 
        success: false, 
        message: 'Backup directory not found' 
      });
    }
    
    // Check if latest backup exists
    if (!fs.existsSync(latestBackupPath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'No backup file found. Please wait for the next backup cycle.' 
      });
    }
    
    // Get file stats
    const stats = fs.statSync(latestBackupPath);
    const fileSize = stats.size;
    const lastModified = stats.mtime;
    
    // Read the backup file
    const backupData = fs.readFileSync(latestBackupPath, 'utf8');
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="pryde-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('X-Backup-Date', lastModified.toISOString());
    res.setHeader('X-Backup-Size', fileSize);
    
    // Send the backup file
    res.send(backupData);
    
    console.log(`✅ Backup downloaded successfully (${(fileSize / 1024).toFixed(2)} KB)`);
  } catch (error) {
    console.error('❌ Backup download error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error downloading backup file',
      error: error.message 
    });
  }
});

// @route   GET /api/backup/info
// @desc    Get information about available backups
// @access  Private (API Key required)
router.get('/info', apiKeyAuth, async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '../backups');
    
    // Check if backup directory exists
    if (!fs.existsSync(backupDir)) {
      return res.json({ 
        success: true,
        backups: [],
        message: 'No backups found yet' 
      });
    }
    
    // Read all backup files
    const files = fs.readdirSync(backupDir);
    const backupFiles = files.filter(file => file.endsWith('.json'));
    
    // Get info for each backup
    const backups = backupFiles.map(file => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      
      return {
        filename: file,
        size: stats.size,
        sizeKB: (stats.size / 1024).toFixed(2),
        created: stats.mtime,
        isLatest: file.includes('latest')
      };
    });
    
    // Sort by creation date (newest first)
    backups.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.json({ 
      success: true,
      count: backups.length,
      backups: backups,
      latestBackup: backups.find(b => b.isLatest) || backups[0]
    });
  } catch (error) {
    console.error('❌ Backup info error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error retrieving backup information',
      error: error.message 
    });
  }
});

// @route   GET /api/backup/health
// @desc    Check backup system health (no auth required)
// @access  Public
router.get('/health', async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '../backups');
    const latestBackupPath = path.join(backupDir, 'full-backup-latest.json');
    
    const exists = fs.existsSync(latestBackupPath);
    
    if (exists) {
      const stats = fs.statSync(latestBackupPath);
      const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
      
      res.json({
        success: true,
        status: 'healthy',
        lastBackup: stats.mtime,
        ageInHours: ageInHours.toFixed(2),
        sizeKB: (stats.size / 1024).toFixed(2)
      });
    } else {
      res.json({
        success: true,
        status: 'no_backups',
        message: 'No backups found yet. Waiting for first backup cycle.'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      status: 'error',
      message: error.message 
    });
  }
});

export default router;

