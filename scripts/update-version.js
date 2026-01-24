/**
 * Auto-update backend version before each build
 * 
 * This script runs automatically during Render builds to ensure
 * the version changes on every deploy, triggering the update banner.
 * 
 * Version format: YYYY.MM.DD-HHmm (e.g., 2026.01.24-1430)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate version string from current timestamp
function generateVersion() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}.${month}.${day}-${hours}${minutes}`;
}

// Update version.js route file
function updateVersionRoute() {
  const versionRoutePath = path.join(__dirname, '..', 'server', 'routes', 'version.js');
  let content = fs.readFileSync(versionRoutePath, 'utf-8');
  
  const version = generateVersion();
  
  // Replace the BACKEND_VERSION line
  const versionRegex = /const BACKEND_VERSION = process\.env\.BUILD_VERSION \|\| '[^']+';/;
  const newVersionLine = `const BACKEND_VERSION = process.env.BUILD_VERSION || '${version}';`;
  
  if (versionRegex.test(content)) {
    content = content.replace(versionRegex, newVersionLine);
    fs.writeFileSync(versionRoutePath, content);
    console.log(`✅ Updated BACKEND_VERSION to ${version}`);
  } else {
    console.error('❌ Could not find BACKEND_VERSION line in version.js');
    process.exit(1);
  }
  
  return version;
}

// Create a version.json file for consistency (optional, for debugging)
function createVersionJson(version) {
  const versionPath = path.join(__dirname, '..', 'version.json');
  const buildTime = new Date().toISOString();
  
  const versionData = {
    version,
    buildTime,
    notes: `Backend build ${version}`
  };
  
  fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n');
  console.log(`✅ Created version.json with ${version}`);
}

// Main
const version = updateVersionRoute();
createVersionJson(version);

console.log(`\n🚀 Backend build version: ${version}`);

