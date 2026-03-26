#!/usr/bin/env node

/**
 * Log viewing script for devrag-cli
 * Usage: node scripts/view-logs.js [options]
 *
 * Options:
 *   --level, -l     Filter by log level (debug, info, warn, error)
 *   --module, -m    Filter by module name
 *   --limit, -n     Number of lines to show (default: 50)
 *   --follow, -f    Follow log output (tail -f mode)
 *   --error         Show only error logs
 *   --json          Output in JSON format
 *   --help, -h      Show this help message
 */

import { readFileSync, existsSync, createReadStream } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

const LOG_DIR = process.env.LOG_DIR || 'logs';

function showHelp() {
  console.log(`
Log viewing script for devrag-cli

Usage: node scripts/view-logs.js [options]

Options:
  --level, -l     Filter by log level (debug, info, warn, error)
  --module, -m    Filter by module name
  --limit, -n     Number of lines to show (default: 50)
  --follow, -f    Follow log output (tail -f mode)
  --error         Show only error logs
  --json          Output in JSON format
  --help, -h      Show this help message

Examples:
  node scripts/view-logs.js                    # Show last 50 lines
  node scripts/view-logs.js -n 100             # Show last 100 lines
  node scripts/view-logs.js --error            # Show only errors
  node scripts/view-logs.js -m api             # Filter by module
  node scripts/view-logs.js -f                 # Follow log output
  node scripts/view-logs.js --json             # Output as JSON
  `);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    level: null,
    module: null,
    limit: 50,
    follow: false,
    errorOnly: false,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--level':
      case '-l':
        options.level = args[++i];
        break;
      case '--module':
      case '-m':
        options.module = args[++i];
        break;
      case '--limit':
      case '-n':
        options.limit = parseInt(args[++i], 10);
        break;
      case '--follow':
      case '-f':
        options.follow = true;
        break;
      case '--error':
        options.errorOnly = true;
        options.level = 'error';
        break;
      case '--json':
        options.json = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        showHelp();
        process.exit(1);
    }
  }

  return options;
}

function formatLogEntry(entry, options) {
  if (options.json) {
    return JSON.stringify(entry);
  }

  const timestamp = entry.timestamp || '';
  const level = entry.level || '';
  const message = entry.message || '';
  const module = entry.module ? `[${entry.module}] ` : '';
  const stack = entry.stack ? `\n${entry.stack}` : '';

  let output = `[${timestamp}] ${level}: ${module}${message}${stack}`;

  // Add error context if available
  if (entry.errorName) {
    output += `\n  Error: ${entry.errorName}: ${entry.errorMessage || entry.errorValue || ''}`;
  }

  return output;
}

function filterLogEntry(entry, options) {
  if (options.level && entry.level !== options.level) {
    return false;
  }

  if (options.module && !entry.module?.includes(options.module)) {
    return false;
  }

  return true;
}

async function tailLog(filename, options) {
  if (!existsSync(filename)) {
    console.error(`Log file not found: ${filename}`);
    console.error('Make sure the application has been started at least once.');
    process.exit(1);
  }

  const rl = createInterface({
    input: createReadStream(filename),
    crlfDelay: Infinity,
  });

  const lines = [];

  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      if (filterLogEntry(entry, options)) {
        lines.push(entry);
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
  }

  // Show last N lines
  const start = Math.max(0, lines.length - options.limit);
  const entries = lines.slice(start);

  if (options.json) {
    entries.forEach(entry => console.log(JSON.stringify(entry)));
  } else {
    entries.forEach(entry => console.log(formatLogEntry(entry, options)));
  }

  console.log(`\n... showing ${entries.length} of ${lines.length} matching entries`);
}

async function followLog(filename, options) {
  if (!existsSync(filename)) {
    console.error(`Log file not found: ${filename}`);
    console.error('Make sure the application has been started at least once.');
    process.exit(1);
  }

  console.log(`Following ${filename} (Ctrl+C to exit)...`);
  console.log('');

  const rl = createInterface({
    input: createReadStream(filename),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      if (filterLogEntry(entry, options)) {
        console.log(formatLogEntry(entry, options));
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
  }
}

async function main() {
  const options = parseArgs();

  // Determine which log file to read
  const logFile = options.errorOnly || options.level === 'error'
    ? join(LOG_DIR, 'error-2025-01-17.log') // Use current date pattern
    : join(LOG_DIR, 'all-2025-01-17.log');

  // Try to find the most recent log file
  const { readdirSync } = await import('fs');
  let targetFile = logFile;

  if (existsSync(LOG_DIR)) {
    const files = readdirSync(LOG_DIR);
    const pattern = options.errorOnly || options.level === 'error'
      ? /^error-(\d{4}-\d{2}-\d{2})\.log$/
      : /^all-(\d{4}-\d{2}-\d{2})\.log$/;

    const matchingFiles = files
      .filter(f => pattern.test(f))
      .sort()
      .reverse();

    if (matchingFiles.length > 0) {
      targetFile = join(LOG_DIR, matchingFiles[0]);
    }
  }

  if (options.follow) {
    await followLog(targetFile, options);
  } else {
    await tailLog(targetFile, options);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
