/**
 * PRYDE FINAL AUDIT RUNNER
 * Non-destructive, read-only structure/security/theme checks
 * No database connection required
 * 
 * Output: PASS / WARN / FAIL
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const results = [];

function pass(msg) {
  results.push({ level: "PASS", msg });
}

function warn(msg) {
  results.push({ level: "WARN", msg });
}

function fail(msg) {
  results.push({ level: "FAIL", msg });
}

function exists(p) {
  return fs.existsSync(path.resolve(ROOT, p));
}

function readFile(p) {
  try {
    return fs.readFileSync(path.resolve(ROOT, p), "utf8");
  } catch {
    return null;
  }
}

console.log("\n=== PRYDE FINAL AUDIT SUITE ===");
console.log("Purpose: Security, Auth, API, Theme, Architecture, Features\n");

/* ====================================
   SECURITY & AUTH AUDIT
==================================== */
console.log("🔐 Security & Auth...");

exists("server/routes/auth.js")
  ? pass("Auth routes exist")
  : fail("Auth routes missing");

exists("server/middleware/auth.js")
  ? pass("Auth middleware exists")
  : fail("Missing auth middleware");

exists("server/middleware/csrf.js")
  ? pass("CSRF protection present")
  : warn("CSRF protection missing");

exists("server/middleware/rateLimiter.js")
  ? pass("Rate limiting present")
  : warn("Rate limiting missing");

exists("server/middleware/hardening.js")
  ? pass("Security hardening middleware present")
  : warn("Security hardening middleware missing");

exists("server/middleware/sanitize.js")
  ? pass("Input sanitization present")
  : warn("Input sanitization missing");

/* ====================================
   API AUDIT
==================================== */
console.log("🔌 API Structure...");

exists("server/routes")
  ? pass("API routes directory present")
  : fail("Missing API routes directory");

exists("server/models")
  ? pass("Database models present")
  : fail("Missing models directory");

exists("server/services")
  ? pass("Services layer present")
  : warn("Services layer missing");

/* ====================================
   THEME AUDIT (check frontend if accessible)
==================================== */
console.log("🎨 Theme Integrity...");

const FRONTEND_PATH = path.resolve(__dirname, "../../../pryde-frontend");
const frontendExists = fs.existsSync(FRONTEND_PATH);

if (frontendExists) {
  // Check design-system.css or variables.css for theme tokens
  const cssFiles = ["src/styles/design-system.css", "src/styles/variables.css", "src/styles/theme.css"];
  let themeTokensFound = false;

  for (const cssFile of cssFiles) {
    const cssPath = path.join(FRONTEND_PATH, cssFile);
    if (fs.existsSync(cssPath)) {
      const css = fs.readFileSync(cssPath, "utf8");
      if (css.includes("--bg-") && css.includes("--text-")) {
        pass(`Theme tokens in use (${path.basename(cssFile)})`);
        themeTokensFound = true;
        break;
      }
    }
  }

  if (!themeTokensFound) {
    warn("Theme tokens incomplete or not found");
  }

  // Check for dark mode support
  const darkModePath = path.join(FRONTEND_PATH, "src/styles/darkMode.css");
  fs.existsSync(darkModePath)
    ? pass("Dark mode stylesheet present")
    : warn("Dark mode stylesheet missing");
} else {
  warn("Frontend not accessible for theme audit");
}

/* ====================================
   ARCHITECTURE AUDIT
==================================== */
console.log("🏗️  Architecture...");

exists("server/utils/logger.js")
  ? pass("Centralized logger present")
  : warn("Centralized logger missing");

exists("server/config")
  ? pass("Config directory present")
  : warn("Config directory missing");

exists("server/audit")
  ? pass("Audit system present")
  : warn("Audit system missing");

/* ====================================
   FEATURE HEALTH AUDIT
==================================== */
console.log("✨ Feature Health...");

exists("server/routes/messages.js")
  ? pass("Messages API present")
  : fail("Messages API missing");

exists("server/routes/posts.js")
  ? pass("Posts API present")
  : fail("Posts API missing");

exists("server/routes/notifications.js")
  ? pass("Notifications API present")
  : fail("Notifications API missing");

exists("server/routes/groups.js")
  ? pass("Groups API present")
  : warn("Groups API missing");

exists("server/routes/passkey.js")
  ? pass("Passkey auth present")
  : warn("Passkey auth missing");

/* ====================================
   BACKUP & RECOVERY AUDIT
==================================== */
console.log("💾 Backup & Recovery...");

exists("server/scripts/backupToCloud.js")
  ? pass("Cloud backup script present")
  : warn("Cloud backup script missing");

exists("server/scripts/dailyBackup.js")
  ? pass("Daily backup script present")
  : warn("Daily backup script missing");

/* ====================================
   FINAL REPORT
==================================== */
console.log("\n=== PRYDE FINAL AUDIT REPORT ===\n");

results.forEach((r) => {
  const icon = r.level === "PASS" ? "✔" : r.level === "WARN" ? "⚠" : "✖";
  console.log(`${icon} [${r.level}] ${r.msg}`);
});

const passed = results.filter((r) => r.level === "PASS").length;
const warned = results.filter((r) => r.level === "WARN").length;
const failed = results.filter((r) => r.level === "FAIL").length;

console.log("\n================================");
console.log(`Summary: ${passed} PASS, ${warned} WARN, ${failed} FAIL`);
console.log("================================\n");

if (failed > 0) {
  console.log("❌ AUDIT FAILED — Fix critical issues before release\n");
  process.exit(1);
} else if (warned > 0) {
  console.log("⚠️  AUDIT PASSED WITH WARNINGS — Review recommendations\n");
  process.exit(0);
} else {
  console.log("✅ AUDIT PASSED — Pryde is structurally sound\n");
  process.exit(0);
}

