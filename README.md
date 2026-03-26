# devrag-cli

Local RAG (Retrieval-Augmented Generation) knowledge base with MCP (Model Context Protocol) integration for Claude Code.

## Features

- **Local Markdown Import**: Import individual markdown files or entire directories
- **Obsidian Vault Support**: Import and maintain your Obsidian note structure
- **Web Crawling**: Crawl web pages using Playwright with JavaScript rendering support
- **Vector Search**: Semantic search using Ollama embeddings and ChromaDB
- **MCP Integration**: Seamless integration with Claude Code via Model Context Protocol
- **Web UI**: Beautiful Vue 3 + Naive UI interface for managing your knowledge base
- **Hybrid Search**: Combines semantic and keyword search for better results

## Prerequisites

- Node.js 18.17.0+
- Ollama (with nomic-embed-text model)
- TypeScript (for development)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd local-rag
```

2. Install dependencies:
```bash
npm install
```

3. Install and start Ollama:
```bash
# Install Ollama from https://ollama.com
# Pull the embedding model
ollama pull nomic-embed-text
```

4. Build the project:
```bash
npm run build
```

## Usage

### Start the Server

Start the full server (API + Web UI + MCP):

```bash
npm start start
```

Or with custom port:

```bash
npm start start -- --port 8080
```

The server will start at:
- Web UI: http://127.0.0.1:3000
- API: http://127.0.0.1:3000/api

### Import Documents

Import a single markdown file:

```bash
npm start import-md ./path/to/document.md
```

Import a directory of markdown files:

```bash
npm start import-md ./path/to/notes/
```

Import an Obsidian vault:

```bash
npm start import-obsidian ~/MyVault
```

Crawl a web page:

```bash
npm start crawl https://example.com/article
```

### MCP Mode

Run in MCP-only mode (for Claude Code integration):

```bash
npm start start -- --mcp
```

Configure in Claude Code settings (`~/.config/claude-code/config.json`):

```json
{
  "mcpServers": {
    "devrag-cli": {
      "command": "node",
      "args": ["/path/to/local-rag/dist/cli.js", "start", "--mcp"]
    }
  }
}
```

## API Endpoints

### Documents

- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get document details
- `DELETE /api/documents/:id` - Delete a document
- `GET /api/documents/:id/progress` - Get vectorization progress

### Search

- `POST /api/search` - Search knowledge base
- `GET /api/suggestions?q=<query>` - Get search suggestions

### Import

- `POST /api/import/markdown` - Import markdown file
- `POST /api/import/obsidian` - Import Obsidian vault
- `POST /api/import/text` - Import text content
- `POST /api/crawl` - Crawl web page

### System

- `GET /api/health` - Health check
- `GET /api/status` - System status

## Development

### Project Structure

```
src/
├── cli.ts                 # CLI entry point
├── server/
│   ├── api/              # REST API (Hono)
│   ├── mcp/              # MCP Server
│   ├── services/         # Business logic
│   └── config/           # Server configuration
├── client/               # Vue 3 Web UI
│   ├── src/
│   │   ├── views/       # Page components
│   │   ├── components/  # Reusable components
│   │   └── composables/ # Vue composables
│   └── index.html
└── shared/
    ├── types/           # TypeScript types
    └── utils/           # Shared utilities
```

### Scripts

- `npm run dev` - Development mode with hot reload
- `npm run build` - Build for production
- `npm run test` - Run unit tests
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

### Architecture

The system uses a layered architecture:

1. **CLI Layer**: Command-line interface for user interaction
2. **API Layer**: REST API using Hono framework
3. **Service Layer**: Business logic for documents, search, embeddings
4. **Data Layer**: ChromaDB for vector storage, file system for documents
5. **MCP Layer**: Model Context Protocol server for Claude integration

## Configuration

Create a `devrag.config.json` file in your project root:

```json
{
  "server": {
    "port": 3000,
    "host": "127.0.0.1"
  },
  "ollama": {
    "baseUrl": "http://127.0.0.1:11434",
    "model": "nomic-embed-text"
  },
  "chromadb": {
    "path": ".devrag/chromadb",
    "collectionName": "documents"
  },
  "processing": {
    "chunkSize": 1000,
    "chunkOverlap": 200,
    "maxConcurrency": 5
  }
}
```

## Troubleshooting

### Ollama Connection Issues

If you see "Ollama connection failed":

1. Make sure Ollama is running: `ollama serve`
2. Check the model is installed: `ollama list`
3. Verify the embedding model: `ollama pull nomic-embed-text`

### ChromaDB Errors

If ChromaDB fails to initialize:

1. Check disk space
2. Verify write permissions
3. Try removing `.devrag/chromadb` and restarting

### Vectorization Slow

If vectorization is slow:

1. Check Ollama is using GPU acceleration
2. Reduce `maxConcurrency` in config
3. Use smaller `chunkSize`

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
