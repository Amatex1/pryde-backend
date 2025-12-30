/**
 * Theme Leak Detector
 * Prevents dark-mode bleed by detecting hardcoded colors
 *
 * RC POLICY (v1.0.0-rc.1):
 * - DO NOT mass-replace existing hardcoded colors
 * - Enforce CSS variables for newly edited files ONLY
 * - Document known exceptions below
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_PATH = path.resolve(__dirname, "../../../pryde-frontend");
const ROOT = path.resolve(__dirname, "../..");

console.log("🎨 Theme Leak Audit...\n");

// Patterns that indicate potential theme leaks (excluding CSS variables)
const patterns = [
  { regex: /(?<!var\()[#]fff\b/gi, name: "#fff" },
  { regex: /(?<!var\()[#]ffffff\b/gi, name: "#ffffff" },
  { regex: /background:\s*white\b/gi, name: "background: white" },
  { regex: /color:\s*white\b/gi, name: "color: white" },
  { regex: /background:\s*black\b/gi, name: "background: black" },
  { regex: /color:\s*black\b/gi, name: "color: black" },
];

// KNOWN EXCEPTIONS - Documented for RC release
// These files intentionally use hardcoded colors and are approved
const knownExceptions = [
  // Design system files (define the variables)
  "design-system.css",
  "variables.css",
  "theme.css",
  "darkMode.css",
  // Loading states (need guaranteed visibility)
  "LoadingSpinner.css",
  "AuthLoadingScreen.css",
  "LoadingGate.css",
  // Third-party component overrides
  "GifPicker.css",
  // Minified vendor files
  ".min.css",
  "node_modules",
];

// Allowed files/patterns (intentional usage)
const allowList = knownExceptions;

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== "build" && file !== "dist") {
        walkDir(filepath, callback);
      }
    } else if (file.endsWith(".css") || file.endsWith(".jsx") || file.endsWith(".js")) {
      callback(filepath);
    }
  }
}

let leaks = [];

if (fs.existsSync(FRONTEND_PATH)) {
  walkDir(path.join(FRONTEND_PATH, "src"), (filepath) => {
    // Skip allowed files
    if (allowList.some(allowed => filepath.includes(allowed))) {
      return;
    }
    
    const content = fs.readFileSync(filepath, "utf8");
    const relativePath = path.relative(FRONTEND_PATH, filepath);
    
    for (const pattern of patterns) {
      const matches = content.match(pattern.regex);
      if (matches) {
        leaks.push({
          file: relativePath,
          pattern: pattern.name,
          count: matches.length,
        });
      }
    }
  });
}

// Check for RC freeze config
let isRCFreeze = false;
const freezePath = path.join(ROOT, "RELEASE_FREEZE.json");
if (fs.existsSync(freezePath)) {
  try {
    const freeze = JSON.parse(fs.readFileSync(freezePath, "utf8"));
    isRCFreeze = freeze.status === "RELEASE_CANDIDATE";
  } catch (e) {}
}

if (leaks.length > 0) {
  console.warn("⚠ Potential theme leaks detected:");
  leaks.forEach((l) => {
    console.warn(`  - ${l.file}: ${l.pattern} (${l.count} occurrence${l.count > 1 ? 's' : ''})`);
  });

  if (isRCFreeze) {
    console.log("\n  📋 RC POLICY: Do NOT mass-replace. Fix only in newly edited files.");
    console.log("  Known exceptions are documented and approved.\n");
  } else {
    console.log("\n  Note: Some may be intentional. Review and use CSS variables where possible.\n");
  }
  // Don't fail - just warn
} else {
  console.log("✔ No obvious theme leaks detected\n");
}

// Export exception list for audit report
export const themeExceptions = knownExceptions;

