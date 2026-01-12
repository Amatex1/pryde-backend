/**
 * Test Runner
 * 
 * Runs all tests and generates coverage report
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = (color, message) => {
  console.log(`${color}${message}${colors.reset}`);
};

const runCommand = (command, args) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
};

const main = async () => {
  log(colors.blue, '\n🧪 Running Pryde Backend Test Suite\n');
  log(colors.blue, '='.repeat(50) + '\n');

  try {
    // Run unit tests
    log(colors.yellow, '📦 Running Unit Tests...\n');
    await runCommand('npm', ['run', 'test:unit']);
    log(colors.green, '\n✅ Unit tests passed!\n');

    // Run integration tests
    log(colors.yellow, '🔗 Running Integration Tests...\n');
    await runCommand('npm', ['run', 'test:integration']);
    log(colors.green, '\n✅ Integration tests passed!\n');

    // Generate coverage report
    log(colors.yellow, '📊 Generating Coverage Report...\n');
    await runCommand('npm', ['run', 'test:coverage']);
    log(colors.green, '\n✅ Coverage report generated!\n');

    log(colors.green, '\n🎉 All tests passed!\n');
    log(colors.blue, '='.repeat(50) + '\n');

    process.exit(0);
  } catch (error) {
    log(colors.red, `\n❌ Tests failed: ${error.message}\n`);
    log(colors.blue, '='.repeat(50) + '\n');
    process.exit(1);
  }
};

main();

