/**
 * Release Guard
 * Enforces audit + version bump + changelog before release
 * Supports RC (release candidate) versions
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const require = createRequire(import.meta.url);
const pkg = require(path.join(ROOT, "package.json"));

console.log("🔒 Release Guard Check...\n");

let failed = false;
let warnings = 0;

// Check for RELEASE_FREEZE.json (RC mode)
const freezePath = path.join(ROOT, "RELEASE_FREEZE.json");
let isRC = false;
let freeze = null;

if (fs.existsSync(freezePath)) {
  freeze = JSON.parse(fs.readFileSync(freezePath, "utf8"));
  isRC = freeze.status === "RELEASE_CANDIDATE";
  console.log(`📋 Mode: ${freeze.status}`);
  console.log(`   Version: ${freeze.version}`);
  console.log(`   Target: ${freeze.targetRelease || "TBD"}\n`);
}

// Check for AUDIT_REPORT.md
const auditReportPath = path.join(ROOT, "AUDIT_REPORT.md");
if (!fs.existsSync(auditReportPath)) {
  console.error("❌ Release blocked: AUDIT_REPORT.md missing");
  console.error("   Run: npm run audit:final");
  failed = true;
} else {
  console.log("✔ AUDIT_REPORT.md exists");
}

// Check for CHANGELOG.md with current version
const changelogPath = path.join(ROOT, "CHANGELOG.md");
if (!fs.existsSync(changelogPath)) {
  console.error("❌ Release blocked: CHANGELOG.md missing");
  failed = true;
} else {
  const changelog = fs.readFileSync(changelogPath, "utf8");
  // Allow base version or RC version in changelog
  const baseVersion = pkg.version.split("-")[0];
  if (!changelog.includes(pkg.version) && !changelog.includes(baseVersion)) {
    console.error(`❌ Release blocked: CHANGELOG.md missing entry for v${pkg.version}`);
    failed = true;
  } else {
    console.log(`✔ CHANGELOG.md contains version entry`);
  }
}

// Check version format (supports semver + RC)
const versionRegex = /^\d+\.\d+\.\d+(-rc\.\d+)?$/;
if (!versionRegex.test(pkg.version)) {
  console.error(`❌ Release blocked: Invalid version format "${pkg.version}"`);
  failed = true;
} else {
  console.log(`✔ Version format valid: ${pkg.version}`);
}

// RC-specific gates
if (isRC && freeze?.releaseGates) {
  console.log("\n📋 Release Gates:");
  const gates = freeze.releaseGates;

  for (const gate of gates.required) {
    const status = gates.status?.[gate] || "pending";
    if (status === "passed") {
      console.log(`  ✔ ${gate}: ${status}`);
    } else if (status === "failed") {
      console.error(`  ❌ ${gate}: ${status}`);
      failed = true;
    } else {
      console.warn(`  ⚠ ${gate}: ${status}`);
      warnings++;
    }
  }
}

// Check auto-deploy status
if (freeze?.approval?.autoDeployEnabled === false) {
  console.log("\n⏸ Auto-deploy DISABLED — Manual approval required");
}

console.log("");

if (failed) {
  console.error("❌ Release guard FAILED — Fix issues before release\n");
  process.exit(1);
} else if (warnings > 0) {
  console.log(`⚠ Release guard PASSED with ${warnings} pending gate(s)\n`);
  console.log("   Verify all gates before final release.\n");
} else {
  console.log("✅ Release guard PASSED — Ready for release\n");
}

