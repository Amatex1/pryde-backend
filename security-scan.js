#!/usr/bin/env node

/**
 * Security Scanner for Pryde Backend
 * Scans for potential credential leaks and security issues
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Patterns to detect potential secrets
const SECRET_PATTERNS = [
  {
    name: 'MongoDB Connection String',
    pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@[^\s"']+/gi,
    severity: 'CRITICAL'
  },
  {
    name: 'JWT Secret',
    pattern: /JWT_SECRET\s*=\s*["']?[a-f0-9]{64,}["']?/gi,
    severity: 'CRITICAL'
  },
  {
    name: 'API Key (Resend)',
    pattern: /re_[a-zA-Z0-9]{30,}/g,
    severity: 'CRITICAL'
  },
  {
    name: 'Generic API Key',
    pattern: /['"](sk|pk|api)_[a-zA-Z0-9]{20,}['"]/gi,
    severity: 'HIGH'
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/gi,
    severity: 'CRITICAL'
  },
  {
    name: 'Password in URL',
    pattern: /[a-z]+:\/\/[^\/\s:@]+:[^\/\s@]+@[^\/\s]+/gi,
    severity: 'HIGH'
  },
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'CRITICAL'
  },
  {
    name: 'Generic Secret',
    pattern: /(secret|password|passwd|pwd)\s*[:=]\s*["'][^"'\s]{16,}["']/gi,
    severity: 'MEDIUM'
  }
];

// Files to exclude from scanning
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /\.env\.example$/,
  /security-scan\.js$/,
  /package-lock\.json$/,
  /yarn\.lock$/
];

let issuesFound = 0;

function shouldScanFile(filePath) {
  return !EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileIssues = [];
    const isTest = isTestFile(filePath);

    SECRET_PATTERNS.forEach(({ name, pattern, severity }) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (isAllowedMatch(filePath, name, match, isTest)) return;

          fileIssues.push({
            type: name,
            severity,
            match: match.substring(0, 50) + (match.length > 50 ? '...' : '')
          });
        });
      }
    });

    if (fileIssues.length > 0) {
      console.log(`\n${colors.red}${colors.bold}❌ ${filePath}${colors.reset}`);
      fileIssues.forEach(issue => {
        const severityColor = issue.severity === 'CRITICAL' ? colors.red :
                              issue.severity === 'HIGH' ? colors.yellow : colors.blue;
        console.log(`  ${severityColor}[${issue.severity}]${colors.reset} ${issue.type}`);
        console.log(`  ${colors.cyan}Found: ${issue.match}${colors.reset}`);
        issuesFound++;
      });
    }

    return fileIssues.length;
  } catch (error) {
    // Ignore binary files and read errors
    return 0;
  }
}

function isPlaceholder(text) {
  const placeholders = [
    /your[-_]?.*[-_]?here/i,
    /YOUR_USERNAME/i,
    /YOUR_PASSWORD/i,
    /YOUR_NEW_PASSWORD/i,
    /YOUR_.*_HERE/i,
    /example/i,
    /placeholder/i,
    /username:password/i,
    /cluster0\.xxxxx/i,
    /\*\*\*\*\*/,
    /xxx/i,
    /replace[-_]?this/i,
    /change[-_]?me/i,
    /change[-_]?in[-_]?production/i,
    /myuser:mypass/i,
    /\$\{.*\}/,  // Template strings like ${username}
  ];
  return placeholders.some(p => p.test(text));
}

// Check if file is a test file or contains test examples
function isTestFile(filePath) {
  const testPatterns = [
    /\.test\./i,
    /\.spec\./i,
    /(^|[\\/])test[-_]/i,
    /test[s]?\//i,
    /tests\//i,
    /__tests__/i,
    /rolePermissionAudit/i,  // Audit scripts with test data
    /mobile-test-suite/i,
    /ROLE_PERMISSION.*\.md$/i,  // Docs describing test scenarios
  ];
  return testPatterns.some(p => p.test(filePath));
}

// Check if it's a test password (common test passwords)
function isTestPassword(text) {
  const testPasswords = [
    /TestPassword123!/i,
    /NoSpecialChar123/i,
    /ValidPassword123!/i,
    /Password123!/i,
    /Test123!/i,
    /TestPass123!@#Secure/i,
  ];
  return testPasswords.some(p => p.test(text));
}

function isAllowedMatch(filePath, name, match, isTest) {
  if (isPlaceholder(match)) {
    return true;
  }

  if (isTest && name === 'Generic Secret') {
    if (isTestPassword(match)) {
      return true;
    }

    if (/\bJBSWY3DPEHPK3PXP\b/i.test(match)) {
      return true;
    }
  }

  const normalizedPath = filePath.replace(/\\/g, '/');
  if (
    normalizedPath.endsWith('server/config/config.js') &&
    name === 'Generic Secret' &&
    /change[-_]?in[-_]?production/i.test(match)
  ) {
    return true;
  }

  return false;
}

function collectFilesRecursively(dir, results = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  files.forEach((file) => {
    const filePath = path.join(dir, file.name);

    if (!shouldScanFile(filePath)) {
      return;
    }

    if (file.isDirectory()) {
      collectFilesRecursively(filePath, results);
      return;
    }

    results.push(filePath);
  });

  return results;
}

function getFilesToScan() {
  try {
    const output = execSync('git ls-files -z --cached --others --exclude-standard', {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString('utf8');

    return output
      .split('\0')
      .filter(Boolean)
      .map((filePath) => path.join(process.cwd(), filePath))
      .filter(shouldScanFile);
  } catch {
    return collectFilesRecursively(process.cwd());
  }
}

console.log(`${colors.bold}${colors.cyan}🔍 Pryde Security Scanner${colors.reset}\n`);
console.log(`${colors.blue}Scanning for potential credential leaks...${colors.reset}`);

// Scan repository-relevant files (tracked + unignored) when possible
getFilesToScan().forEach(scanFile);

// Summary
console.log(`\n${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
if (issuesFound === 0) {
  console.log(`${colors.green}${colors.bold}✅ No credential leaks detected!${colors.reset}`);
} else {
  console.log(`${colors.red}${colors.bold}⚠️  Found ${issuesFound} potential issue(s)${colors.reset}`);
  console.log(`\n${colors.yellow}Action required:${colors.reset}`);
  console.log(`1. Review the files listed above`);
  console.log(`2. Remove any real credentials`);
  console.log(`3. Rotate any exposed secrets`);
  console.log(`4. Add sensitive files to .gitignore`);
}
console.log(`${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

process.exit(issuesFound > 0 ? 1 : 0);

