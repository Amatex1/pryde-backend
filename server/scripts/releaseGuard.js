/**
 * Release Guard
 * Enforces audit + version bump + changelog before release
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
  if (!changelog.includes(pkg.version)) {
    console.error(`❌ Release blocked: CHANGELOG.md missing entry for v${pkg.version}`);
    failed = true;
  } else {
    console.log(`✔ CHANGELOG.md contains v${pkg.version}`);
  }
}

// Check version format
const versionRegex = /^\d+\.\d+\.\d+$/;
if (!versionRegex.test(pkg.version)) {
  console.error(`❌ Release blocked: Invalid version format "${pkg.version}"`);
  failed = true;
} else {
  console.log(`✔ Version format valid: ${pkg.version}`);
}

console.log("");

if (failed) {
  console.error("❌ Release guard FAILED — Fix issues before release\n");
  process.exit(1);
} else {
  console.log("✅ Release guard PASSED — Ready for release\n");
}

