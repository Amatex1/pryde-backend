/**
 * Feature Freeze Guard
 * 
 * Enforces release candidate freeze policy.
 * Run before commits during freeze period.
 * 
 * Usage: npm run freeze:check
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

console.log("\n🧊 Feature Freeze Guard\n");

// Load freeze config
const freezePath = path.join(ROOT, "RELEASE_FREEZE.json");
if (!fs.existsSync(freezePath)) {
  console.log("✔ No freeze active (RELEASE_FREEZE.json not found)");
  process.exit(0);
}

const freeze = JSON.parse(fs.readFileSync(freezePath, "utf8"));

if (!freeze.featureFreeze?.enabled) {
  console.log("✔ Feature freeze not enabled");
  process.exit(0);
}

console.log(`🔒 Freeze Status: ${freeze.status}`);
console.log(`   Version: ${freeze.version}`);
console.log(`   Freeze Date: ${freeze.freezeDate}\n`);

// Get staged files
let stagedFiles = [];
try {
  const output = execSync("git diff --cached --name-only", { 
    cwd: ROOT, 
    encoding: "utf8" 
  });
  stagedFiles = output.trim().split("\n").filter(Boolean);
} catch (e) {
  console.log("⚠ Could not get staged files, skipping check");
  process.exit(0);
}

if (stagedFiles.length === 0) {
  console.log("✔ No staged files");
  process.exit(0);
}

console.log(`Checking ${stagedFiles.length} staged file(s)...\n`);

const violations = [];
const blocked = freeze.featureFreeze.blockedChanges;

// Check for new component files
const newComponents = stagedFiles.filter(f => 
  f.includes("components/") && 
  f.endsWith(".jsx") &&
  !fs.existsSync(path.join(ROOT, f))
);

if (newComponents.length > 0 && blocked.includes("new-ui-component")) {
  violations.push({
    type: "new-ui-component",
    files: newComponents,
    message: "New UI components blocked during freeze"
  });
}

// Check for schema changes
const schemaFiles = stagedFiles.filter(f => 
  f.includes("models/") || 
  f.includes("migrations/") ||
  f.includes("schema")
);

if (schemaFiles.length > 0 && blocked.includes("schema-change")) {
  violations.push({
    type: "schema-change", 
    files: schemaFiles,
    message: "Schema changes blocked during freeze"
  });
}

// Check for new API routes
const newRoutes = stagedFiles.filter(f =>
  f.includes("routes/") &&
  !fs.existsSync(path.join(ROOT, f))
);

if (newRoutes.length > 0 && blocked.includes("api-change")) {
  violations.push({
    type: "api-change",
    files: newRoutes,
    message: "New API routes blocked during freeze"
  });
}

// Report violations
if (violations.length > 0) {
  console.log("❌ FREEZE VIOLATIONS DETECTED:\n");
  violations.forEach(v => {
    console.log(`   ${v.type}: ${v.message}`);
    v.files.forEach(f => console.log(`     - ${f}`));
    console.log();
  });
  
  console.log("Allowed during freeze:");
  freeze.featureFreeze.allowedChanges.forEach(c => 
    console.log(`   ✔ ${c}`)
  );
  
  console.log("\n❌ Commit blocked by feature freeze\n");
  process.exit(1);
}

console.log("✅ All changes comply with freeze policy\n");

// Show allowed change types
console.log("Allowed changes:");
freeze.featureFreeze.allowedChanges.forEach(c => 
  console.log(`   ✔ ${c}`)
);
console.log();

