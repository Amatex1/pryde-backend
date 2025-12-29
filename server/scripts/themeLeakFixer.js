/**
 * Theme Leak Helper
 * Flags easy conversions vs manual review
 * 
 * Usage: npm run polish:theme
 * 
 * This script:
 * 1. Auto-fixes simple color patterns → CSS variables
 * 2. Flags files needing manual review
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_PATH = path.resolve(__dirname, "../../../pryde-frontend");

console.log("🎨 Theme Leak Fixer\n");

// Easy auto-fix mappings (safe conversions)
const EASY_MAP = {
  // Background patterns - only in specific contexts
  "background: #fff": "background: var(--bg-card)",
  "background: #ffffff": "background: var(--bg-card)",
  "background:#fff": "background: var(--bg-card)",
  "background:#ffffff": "background: var(--bg-card)",
};

// Patterns requiring manual review
const MANUAL_PATTERNS = [
  /color:\s*white\b/gi,
  /color:\s*black\b/gi,
  /background:\s*white\b/gi,
  /background:\s*black\b/gi,
  /\brgb\s*\(/gi,
  /\brgba\s*\(/gi,
];

// Files/directories to skip
const skipList = [
  "node_modules",
  ".git",
  "build",
  "dist",
  "design-system.css",
  "variables.css",
  "theme.css",
  "darkMode.css",
  ".min.css",
];

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    
    if (skipList.some(skip => filepath.includes(skip))) continue;
    
    const stat = fs.statSync(filepath);
    
    if (stat.isDirectory()) {
      walkDir(filepath, callback);
    } else if (file.endsWith(".css")) {
      callback(filepath);
    }
  }
}

let autoFixed = [];
let manualReview = [];

const dryRun = process.argv.includes("--dry-run");

if (dryRun) {
  console.log("🔍 DRY RUN MODE - No files will be modified\n");
}

if (!fs.existsSync(FRONTEND_PATH)) {
  console.error("❌ Frontend not found at:", FRONTEND_PATH);
  process.exit(1);
}

walkDir(path.join(FRONTEND_PATH, "src"), (filepath) => {
  let content = fs.readFileSync(filepath, "utf8");
  let updated = content;
  let wasFixed = false;
  
  // Apply easy auto-fixes
  for (const [pattern, replacement] of Object.entries(EASY_MAP)) {
    const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
    if (regex.test(updated)) {
      updated = updated.replace(regex, replacement);
      wasFixed = true;
    }
  }
  
  if (wasFixed) {
    const relativePath = path.relative(FRONTEND_PATH, filepath);
    autoFixed.push(relativePath);
    
    if (!dryRun) {
      fs.writeFileSync(filepath, updated);
    }
  }
  
  // Check for manual review patterns
  for (const pattern of MANUAL_PATTERNS) {
    if (pattern.test(content)) {
      const relativePath = path.relative(FRONTEND_PATH, filepath);
      if (!manualReview.includes(relativePath)) {
        manualReview.push(relativePath);
      }
      break;
    }
  }
});

// Report results
if (autoFixed.length > 0) {
  console.log(`✅ Auto-fixed ${autoFixed.length} file(s)${dryRun ? " (dry run)" : ""}:`);
  autoFixed.forEach(f => console.log(`   - ${f}`));
} else {
  console.log("✔ No easy auto-fixes available");
}

if (manualReview.length > 0) {
  console.log(`\n⚠ ${manualReview.length} file(s) need manual review:`);
  manualReview.slice(0, 20).forEach(f => console.log(`   - ${f}`));
  if (manualReview.length > 20) {
    console.log(`   ... and ${manualReview.length - 20} more`);
  }
  console.log("\n   Use CSS variables: --bg-card, --bg-main, --text-main, --text-muted");
}

console.log("\n✔ Theme leak analysis complete\n");

