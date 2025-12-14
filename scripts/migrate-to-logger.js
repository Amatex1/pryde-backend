/**
 * Script to migrate console.log/error/warn/info to logger utility
 * Usage: node scripts/migrate-to-logger.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');

// Files to migrate (frontend)
const frontendFiles = [
  'src/pages/Feed.jsx',
  'src/pages/Profile.jsx',
  'src/pages/Messages.jsx',
  'src/pages/GlobalFeed.jsx',
  'src/pages/Notifications.jsx',
  'src/pages/Settings.jsx',
  'src/components/SafetyWarning.jsx',
  'src/components/ErrorBoundary.jsx',
  'src/utils/socket.js',
  'src/utils/api.js'
];

// Files to migrate (backend)
const backendFiles = [
  'server/routes/auth.js',
  'server/routes/posts.js',
  'server/routes/messages.js',
  'server/routes/search.js',
  'server/middleware/moderation.js',
  'server/scripts/checkDatabase.js'
];

/**
 * Replace console statements with logger
 */
function migrateFile(filePath, isFrontend = true) {
  const fullPath = path.join(projectRoot, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} (not found)`);
    return { skipped: true };
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  
  // Check if logger is already imported
  const hasLoggerImport = content.includes("from './utils/logger'") || 
                          content.includes("from '../utils/logger.js'");
  
  // Add logger import if not present
  if (!hasLoggerImport) {
    if (isFrontend) {
      // Find the last import statement
      const importRegex = /^import .+ from .+;$/gm;
      const imports = content.match(importRegex);
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertPosition = lastImportIndex + lastImport.length;
        content = content.slice(0, insertPosition) + 
                  "\nimport logger from './utils/logger';" +
                  content.slice(insertPosition);
      }
    } else {
      // Backend - add after other imports
      const importRegex = /^import .+ from .+;$/gm;
      const imports = content.match(importRegex);
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const insertPosition = lastImportIndex + lastImport.length;
        content = content.slice(0, insertPosition) + 
                  "\nimport logger from '../utils/logger.js';" +
                  content.slice(insertPosition);
      }
    }
  }
  
  // Replace console statements
  let replacements = 0;
  
  // console.error -> logger.error
  content = content.replace(/console\.error\(/g, () => {
    replacements++;
    return 'logger.error(';
  });
  
  // console.warn -> logger.warn
  content = content.replace(/console\.warn\(/g, () => {
    replacements++;
    return 'logger.warn(';
  });
  
  // console.log -> logger.debug (for development-only logs)
  content = content.replace(/console\.log\(/g, () => {
    replacements++;
    return 'logger.debug(';
  });
  
  // console.info -> logger.info
  content = content.replace(/console\.info\(/g, () => {
    replacements++;
    return 'logger.info(';
  });
  
  // Only write if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    return { success: true, replacements };
  }
  
  return { noChanges: true };
}

/**
 * Main migration function
 */
function main() {
  console.log('🚀 Starting logger migration...\n');
  
  let totalReplacements = 0;
  let filesModified = 0;
  let filesSkipped = 0;
  
  console.log('📱 Migrating frontend files...');
  frontendFiles.forEach(file => {
    const result = migrateFile(file, true);
    if (result.success) {
      console.log(`✅ ${file} (${result.replacements} replacements)`);
      totalReplacements += result.replacements;
      filesModified++;
    } else if (result.skipped) {
      filesSkipped++;
    } else if (result.noChanges) {
      console.log(`⏭️  ${file} (no changes needed)`);
    }
  });
  
  console.log('\n🖥️  Migrating backend files...');
  backendFiles.forEach(file => {
    const result = migrateFile(file, false);
    if (result.success) {
      console.log(`✅ ${file} (${result.replacements} replacements)`);
      totalReplacements += result.replacements;
      filesModified++;
    } else if (result.skipped) {
      filesSkipped++;
    } else if (result.noChanges) {
      console.log(`⏭️  ${file} (no changes needed)`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Migration complete!`);
  console.log(`   Files modified: ${filesModified}`);
  console.log(`   Files skipped: ${filesSkipped}`);
  console.log(`   Total replacements: ${totalReplacements}`);
  console.log('='.repeat(60));
}

main();

