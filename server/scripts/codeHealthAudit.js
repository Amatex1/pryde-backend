/**
 * Static Code Health Audit
 * Detects TODOs, FIXMEs, and stray console.logs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

console.log("🔍 Code Health Audit...\n");

const flags = [
  { regex: /\/\/\s*TODO:/gi, name: "TODO" },
  { regex: /\/\/\s*FIXME:/gi, name: "FIXME" },
  { regex: /\/\/\s*HACK:/gi, name: "HACK" },
  { regex: /console\.log\(/g, name: "console.log" },
];

// Files/directories to skip
const skipList = [
  "node_modules",
  ".git",
  "build",
  "dist",
  ".min.js",
  "logger.js", // Logger is allowed to have console
  "devConsole.js",
];

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    
    // Skip listed directories/files
    if (skipList.some(skip => filepath.includes(skip))) continue;
    
    const stat = fs.statSync(filepath);
    
    if (stat.isDirectory()) {
      walkDir(filepath, callback);
    } else if (file.endsWith(".js") || file.endsWith(".jsx")) {
      callback(filepath);
    }
  }
}

let issues = {
  TODO: [],
  FIXME: [],
  HACK: [],
  "console.log": [],
};

// Check server directory
walkDir(path.join(ROOT, "server"), (filepath) => {
  const content = fs.readFileSync(filepath, "utf8");
  const relativePath = path.relative(ROOT, filepath);
  
  for (const flag of flags) {
    const matches = content.match(flag.regex);
    if (matches) {
      issues[flag.name].push({
        file: relativePath,
        count: matches.length,
      });
    }
  }
});

const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);

if (totalIssues > 0) {
  console.warn("⚠ Code health warnings:\n");
  
  for (const [type, files] of Object.entries(issues)) {
    if (files.length > 0) {
      console.warn(`  ${type}:`);
      files.forEach((f) => {
        console.warn(`    - ${f.file} (${f.count})`);
      });
    }
  }
  
  console.log("\n  Note: Review and clean up before production release.\n");
} else {
  console.log("✔ Code health clean — No TODOs, FIXMEs, or stray console.logs\n");
}

