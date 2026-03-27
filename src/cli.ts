#!/usr/bin/env node
/**
 * CLI entry point for devrag-cli
 */

import { Command } from 'commander';
import { config } from './shared/utils/config.js';
import { createLogger, setLogLevel } from './shared/utils/logger.js';
import { startServer } from './server/api/index.js';
import { mcpServer } from './server/mcp/server.js';
import { documentService } from './server/services/documents.js';
import { crawlerService } from './server/services/crawler.js';
import { embeddingService } from './server/services/embeddings.js';
import { vectorStore } from './server/services/vectorstore.js';
import { existsSync } from 'fs';

const log = createLogger('cli');

const program = new Command();

program
  .name('devrag-cli')
  .description('Local RAG knowledge base with MCP integration for Claude Code')
  .version('1.0.0');

// Start command
program
  .command('start')
  .description('Start the devrag-cli server (API + Web UI + MCP)')
  .option('-p, --port <number>', 'Port for the web server', (value) => parseInt(value), 3000)
  .option('-h, --host <string>', 'Host to bind to', '127.0.0.1')
  .option('--mcp', 'Start MCP server mode (stdio communication)')
  .action(async (options) => {
    try {
      // Update config
      config.set('server', {
        port: options.port,
        host: options.host,
        cors: false,
      });

      // Set log level
      setLogLevel(config.get('logging').level);

      log.info('Starting devrag-cli...');
      log.info(`Configuration: ${JSON.stringify(config.getAll(), null, 2)}`);

      // Check dependencies (strict mode for start command)
      await checkDependencies(true);

      if (options.mcp) {
        // Start MCP server only
        await embeddingService.initialize();
        await vectorStore.initialize();
        await mcpServer.start();

        log.info('MCP Server running. Press Ctrl+C to stop.');

        // Keep process alive
        process.on('SIGINT', async () => {
          log.info('Shutting down MCP Server...');
          await mcpServer.stop();
          process.exit(0);
        });
      } else {
        // Start full server (API + Web UI)
        const server = await startServer();

        // Also start MCP server in background
        try {
          await embeddingService.initialize();
          await vectorStore.initialize();
          await mcpServer.start();
        } catch (error) {
          log.warn('MCP Server failed to start, continuing without it');
        }

        log.info('Server started successfully!');
        log.info(`Web UI: http://${options.host}:${options.port}`);
        log.info(`API: http://${options.host}:${options.port}/api`);
        log.info('');
        log.info('Press Ctrl+C to stop the server.');

        // Graceful shutdown
        process.on('SIGINT', async () => {
          log.info('Shutting down server...');
          await mcpServer.stop();
          await crawlerService.close();
          server.close();
          process.exit(0);
        });
      }
    } catch (error) {
      log.error('Failed to start server', error);
      process.exit(1);
    }
  });

// Import commands
program
  .command('import-md')
  .description('Import a markdown file or directory')
  .argument('<path>', 'Path to markdown file or directory')
  .option('-t, --tags <tags...>', 'Tags to add to documents')
  .option('--skip-errors', 'Continue on errors')
  .action(async (path, options) => {
    try {
      await checkDependencies(true);

      if (!existsSync(path)) {
        log.error(`Path does not exist: ${path}`);
        process.exit(1);
      }

      const stats = await importPath(path, options);
      log.info('Import completed!');
      log.info(`Documents imported: ${stats.count}`);
      log.info(`Failed: ${stats.failed}`);
    } catch (error) {
      log.error('Import failed', error);
      process.exit(1);
    }
  });

program
  .command('import-obsidian')
  .description('Import an Obsidian vault')
  .argument('<vaultPath>', 'Path to Obsidian vault directory')
  .option('-t, --tags <tags...>', 'Tags to add to documents')
  .option('--skip-errors', 'Continue on errors')
  .action(async (vaultPath, options) => {
    try {
      await checkDependencies(true);

      const stats = await importObsidian(vaultPath, options);
      log.info('Obsidian import completed!');
      log.info(`Documents imported: ${stats.count}`);
      log.info(`Failed: ${stats.failed}`);
    } catch (error) {
      log.error('Import failed', error);
      process.exit(1);
    }
  });

// Crawl command
program
  .command('crawl')
  .description('Crawl a web page and import content')
  .argument('<url>', 'URL to crawl')
  .option('-c, --cookies <cookies>', 'Cookies as JSON object')
  .option('-s, --screenshot', 'Take screenshot')
  .action(async (url, options) => {
    try {
      await checkDependencies(true);

      await crawlUrl(url, options);
      log.info('Crawl completed!');
    } catch (error) {
      log.error('Crawl failed', error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Check system status and dependencies')
  .action(async () => {
    try {
      // Use non-strict dependency check for status command
      await checkDependencies(false);
      await checkStatus();
    } catch (error) {
      log.error('Status check failed', error);
      process.exit(1);
    }
  });

// Helper functions
async function checkDependencies(strict = true): Promise<void> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check Ollama
  try {
    await embeddingService.initialize();
    log.info('✓ Ollama connection OK');
  } catch (error) {
    const msg = 'Ollama: Not connected. Make sure Ollama is running (https://ollama.com)';
    if (strict) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  // Check ChromaDB
  try {
    await vectorStore.initialize();
    log.info('✓ ChromaDB initialized OK');
  } catch (error) {
    const msg = 'ChromaDB: Failed to initialize';
    if (strict) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  // Log warnings in non-strict mode
  if (!strict && warnings.length > 0) {
    warnings.forEach(w => log.warn(w));
  }

  // Only throw in strict mode
  if (strict && errors.length > 0) {
    throw new Error(`Dependency check failed:\n${errors.join('\n')}`);
  }
}

async function importPath(path: string, options: any) {
  const stats = { count: 0, failed: 0 };

  try {
    const documents = await documentService.importMarkdownDirectory(path, {
      tags: options.tags,
      skipErrors: options.skipErrors,
      onProgress: (progress) => {
        log.info(
          `Vectorizing: ${progress.documentTitle} (${progress.processedChunks}/${progress.totalChunks})`
        );
      },
    });

    stats.count = documents.length;
  } catch (error) {
    if (!options.skipErrors) {
      throw error;
    }
    stats.failed++;
  }

  return stats;
}

async function importObsidian(vaultPath: string, options: any) {
  const stats = { count: 0, failed: 0 };

  try {
    const documents = await documentService.importObsidianVault(vaultPath, {
      tags: [...(options.tags || []), 'obsidian'],
      skipErrors: options.skipErrors,
      onProgress: (progress) => {
        log.info(
          `Vectorizing: ${progress.documentTitle} (${progress.processedChunks}/${progress.totalChunks})`
        );
      },
    });

    stats.count = documents.length;
  } catch (error) {
    if (!options.skipErrors) {
      throw error;
    }
    stats.failed++;
  }

  return stats;
}

async function crawlUrl(url: string, options: any) {
  const crawlConfig: any = {
    url,
    screenshot: options.screenshot,
  };

  if (options.cookies) {
    try {
      crawlConfig.cookies = JSON.parse(options.cookies);
    } catch (error) {
      throw new Error('Invalid cookies JSON');
    }
  }

  await crawlerService.crawlAndImport(crawlConfig);
}

async function checkStatus() {
  console.log('\n=== devrag-cli System Status ===\n');

  // Check Ollama
  console.log('Ollama:');
  try {
    await embeddingService.initialize();
    console.log(`  Status: Connected ✓`);
    console.log(`  Model: ${embeddingService.getModel()}`);
    console.log(`  Dimension: ${embeddingService.getDimension()}`);
  } catch (error) {
    console.log(`  Status: Disconnected ✗`);
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Check ChromaDB
  console.log('\nChromaDB:');
  try {
    await vectorStore.initialize();
    const count = await vectorStore.getDocumentCount();
    console.log(`  Status: Initialized ✓`);
    console.log(`  Documents: ${count}`);
  } catch (error) {
    console.log(`  Status: Failed ✗`);
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Check documents
  console.log('\nDocuments:');
  const documents = documentService.getAllDocuments();
  console.log(`  Total: ${documents.length}`);
  console.log(`  Completed: ${documents.filter((d) => d.vectorizationStatus === 'completed').length}`);
  console.log(`  Failed: ${documents.filter((d) => d.vectorizationStatus === 'failed').length}`);

  console.log('');
}

// Parse arguments
program.parse();
