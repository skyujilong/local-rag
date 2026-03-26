# Quick Start Guide - devrag-cli

## Prerequisites Installation

### 1. Install Node.js (v18.17.0+)

```bash
# Check if Node.js is installed
node --version

# If not, install from https://nodejs.org
```

### 2. Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama service
ollama serve

# Pull the embedding model
ollama pull nomic-embed-text
```

### 3. Install Playwright Browsers

```bash
npx playwright install chromium
```

## Project Setup

### 1. Install Dependencies

```bash
cd /Users/jilong5/mfe-workspace/local-rag
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Start the Server

```bash
npm start start
```

You should see:
```
[INFO] Starting devrag-cli...
[INFO] ✓ Ollama connection OK
[INFO] ✓ ChromaDB initialized OK
[INFO] Server started successfully!
[INFO] Web UI: http://127.0.0.1:3000
[INFO] API: http://127.0.0.1:3000/api
```

## Basic Usage

### Access Web UI

Open your browser: http://127.0.0.1:3000

### Import Your First Document

**Option 1: Using CLI**
```bash
# Import a single markdown file
npm start import-md ./test.md

# Import a directory
npm start import-md ~/notes/
```

**Option 2: Using Web UI**
1. Navigate to Documents page
2. Click "Import Document"
3. Choose import method (Markdown File / Text Content / Web URL)
4. Follow the wizard

### Search Your Knowledge Base

**Option 1: Using Web UI**
1. Navigate to Search page
2. Enter your query
3. View results with relevance scores

**Option 2: Using API**
```bash
curl -X POST http://127.0.0.1:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"your search query","topK":3}'
```

## Configure Claude Code Integration

### 1. Update Claude Code Config

Edit `~/.config/claude-code/config.json`:

```json
{
  "mcpServers": {
    "devrag-cli": {
      "command": "node",
      "args": ["/Users/jilong5/mfe-workspace/local-rag/dist/cli.js", "start", "--mcp"]
    }
  }
}
```

### 2. Restart Claude Code

### 3. Test Integration

In Claude Code, ask:
```
"Search my knowledge base for information about [topic]"
```

Claude will automatically call the MCP tool and provide results.

## Common Workflows

### 1. Import Obsidian Vault

```bash
npm start import-obsidian ~/Documents/MyVault
```

### 2. Crawl Documentation Website

```bash
npm start crawl https://docs.example.com/getting-started
```

### 3. Check System Status

```bash
npm start status
```

### 4. Run in MCP-Only Mode

```bash
npm start start -- --mcp
```

## Troubleshooting

### Ollama Connection Failed

```bash
# Check if Ollama is running
ps aux | grep ollama

# Start Ollama
ollama serve

# Verify model is installed
ollama list
# Should show: nomic-embed-text

# If missing, pull it
ollama pull nomic-embed-text
```

### Port Already in Use

```bash
# Use different port
npm start start -- --port 8080
```

### Import Errors

```bash
# Skip errors and continue
npm start import-md ./notes/ --skip-errors
```

### Vectorization Slow

Edit `devrag.config.json`:
```json
{
  "processing": {
    "maxConcurrency": 2
  }
}
```

## Development

### Run in Development Mode

```bash
npm run dev
```

### Run Tests

```bash
npm run test
```

### Lint Code

```bash
npm run lint
npm run lint:fix
```

### Format Code

```bash
npm run format
```

## Next Steps

1. Import your existing notes and documents
2. Set up Claude Code integration
3. Explore the Web UI
4. Customize configuration in `devrag.config.json`
5. Check system status regularly

## Getting Help

- Check README.md for detailed documentation
- Review IMPLEMENTATION_SUMMARY.md for architecture details
- Check logs in the console output
- Open an issue on GitHub

## Tips

- Start with a few documents to test the system
- Use descriptive tags when importing documents
- Check the Dashboard for system health
- Use hybrid search for best results
- Regularly check vectorization progress
- Backup `.devrag/` directory periodically
