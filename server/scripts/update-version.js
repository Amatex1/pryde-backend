/**
 * Auto-update backend version before each deploy
 * 
 * This script runs automatically during Render builds to ensure
 * the version changes on every deploy.
 * 
 * Version format: YYYY.MM.DD-HHmm (e.g., 2026.02.14-1430)
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

// Update version.js with new version
function updateVersionJs() {
  const versionPath = path.join(__dirname, '..', 'routes', 'version.js');
  const version = generateVersion();
  
  // Read the current file
  let content = fs.readFileSync(versionPath, 'utf-8');
  
  // Replace the BACKEND_VERSION line
  const versionRegex = /const BACKEND_VERSION = process\.env\.BUILD_VERSION \|\| '[^']+';/;
  const newVersionLine = `const BACKEND_VERSION = process.env.BUILD_VERSION || '${version}';`;
  
  content = content.replace(versionRegex, newVersionLine);
  
  // Write back to file
  fs.writeFileSync(versionPath, content);
  console.log(`✅ Updated version.js to ${version}`);
  
  return version;
}

// Update package.json buildVersion
function updatePackageJson(version) {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  
  packageJson.buildVersion = version;
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Updated package.json buildVersion to ${version}`);
}

// Main
const version = updateVersionJs();
updatePackageJson(version);

console.log(`\n🚀 Backend build version: ${version}`);

