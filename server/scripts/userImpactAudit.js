/**
 * User Impact Audit (Critical Path)
 * Ensures core user journey paths exist
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const FRONTEND_PATH = path.resolve(__dirname, "../../../pryde-frontend");

console.log("👤 User Impact Audit (Critical Paths)...\n");

// Backend critical paths
const backendPaths = [
  "server/routes/auth.js",
  "server/routes/users.js",
  "server/routes/posts.js",
  "server/routes/messages.js",
  "server/routes/notifications.js",
  "server/middleware/auth.js",
  "server/models/User.js",
  "server/models/Post.js",
];

// Frontend critical paths (aligned with actual structure)
const frontendPaths = [
  "src/pages/Login.jsx",
  "src/pages/Register.jsx",
  "src/pages/Profile.jsx",
  "src/pages/Feed.jsx",
  "src/pages/Messages.jsx",
  "src/utils/auth.js",         // Auth utilities
  "src/utils/apiClient.js",    // API client
  "src/context/AuthContext.jsx", // Auth state
];

let failed = false;
let warnings = 0;

console.log("Backend paths:");
backendPaths.forEach((f) => {
  const fullPath = path.join(ROOT, f);
  if (!fs.existsSync(fullPath)) {
    console.error(`  ❌ Missing: ${f}`);
    failed = true;
  } else {
    console.log(`  ✔ ${f}`);
  }
});

console.log("\nFrontend paths:");
if (fs.existsSync(FRONTEND_PATH)) {
  frontendPaths.forEach((f) => {
    const fullPath = path.join(FRONTEND_PATH, f);
    if (!fs.existsSync(fullPath)) {
      console.warn(`  ⚠ Missing: ${f}`);
      warnings++;
    } else {
      console.log(`  ✔ ${f}`);
    }
  });
} else {
  console.warn("  ⚠ Frontend not accessible for audit");
  warnings++;
}

console.log("");

if (failed) {
  console.error("❌ User impact audit FAILED — Critical backend paths missing\n");
  process.exit(1);
} else if (warnings > 0) {
  console.log(`⚠ User impact audit passed with ${warnings} warning(s)\n`);
} else {
  console.log("✅ User impact audit PASSED — All critical paths verified\n");
}

