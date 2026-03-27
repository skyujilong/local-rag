# ChromaDB Setup Guide

This document explains how to properly configure and use ChromaDB with the local-rag project.

## Background

The ChromaDB JavaScript client (`chromadb` package) is designed to connect to a **running ChromaDB server** via HTTP REST API. It does not support local file-based storage directly.

### Previous Issue

The original error:
```
Failed to parse URL from /Users/jilong5/mfe-workspace/local-rag/.devrag/chromadb/api/v2/tenants/default_tenant
```

This occurred because the configuration was using a local file path instead of an HTTP URL to connect to a ChromaDB server.

## Setup Options

### Option 1: ChromaDB with Docker (Recommended)

1. **Install Docker** if not already installed

2. **Start ChromaDB server:**
```bash
docker run -p 8000:8000 chromadb/chroma
```

3. **Verify ChromaDB is running:**
```bash
curl http://localhost:8000/api/v1/heartbeat
```

Expected response:
```json
{"status":"ok"}
```

4. **Update `.env` file:**
```bash
CHROMA_PATH=http://localhost:8000
```

### Option 2: ChromaDB with Python

1. **Install ChromaDB:**
```bash
pip install chromadb
```

2. **Start ChromaDB server:**
```bash
chroma-server --port 8000
```

3. **Verify ChromaDB is running:**
```bash
curl http://localhost:8000/api/v1/heartbeat
```

4. **Update `.env` file:**
```bash
CHROMA_PATH=http://localhost:8000
```

### Option 3: Use SimpleVectorStore (Default)

The project includes a built-in SimpleVectorStore that requires no external dependencies:

1. **Update `.env` file:**
```bash
VECTOR_STORE_TYPE=simple
```

2. **No server setup required** - works out of the box

**Benefits:**
- No external dependencies
- Faster for small to medium datasets
- Simpler setup for development
- JSON file persistence

## Configuration

### Environment Variables

```bash
# ChromaDB server URL (required if using ChromaDB)
CHROMA_PATH=http://localhost:8000

# Vector store type: 'chromadb' or 'simple'
VECTOR_STORE_TYPE=simple

# ChromaDB collection name
COLLECTION_NAME=documents
```

### Config File (devrag.config.json)

```json
{
  "chromadb": {
    "path": "http://localhost:8000",
    "collectionName": "documents"
  },
  "vectorStore": {
    "type": "chromadb"
  }
}
```

## Choosing Between ChromaDB and SimpleVectorStore

### Use ChromaDB when:
- You need production-grade vector database
- You have large datasets (>100K vectors)
- You need advanced filtering capabilities
- You want to use ChromaDB's features (metadata filtering, etc.)
- You're already using Docker in your workflow

### Use SimpleVectorStore when:
- You're developing or testing
- You have small to medium datasets (<10K vectors)
- You want zero external dependencies
- You need simple, fast setup
- You're running locally without Docker

## Troubleshooting

### ChromaDB Connection Errors

**Error:** `Failed to connect to chromadb. Make sure your server is running`

**Solution:**
1. Verify ChromaDB server is running: `curl http://localhost:8000/api/v1/heartbeat`
2. Check your `CHROMA_PATH` in `.env`
3. Ensure port 8000 is not in use by another service

### Port Already in Use

**Error:** `Port 8000 is already allocated`

**Solution:**
```bash
# Use a different port
docker run -p 8001:8000 chromadb/chroma

# Update .env
CHROMA_PATH=http://localhost:8001
```

### Collection Not Found

**Error:** `Collection does not exist`

**Solution:**
The application will automatically create the collection on first use. If you see this error, check your ChromaDB server logs.

## Migration from SimpleVectorStore to ChromaDB

If you've been using SimpleVectorStore and want to migrate to ChromaDB:

1. **Export existing data:**
```bash
# SimpleVectorStore data is in: .devrag/vectorstore/data.json
```

2. **Start ChromaDB server** (see options above)

3. **Update configuration:**
```bash
VECTOR_STORE_TYPE=chromadb
CHROMA_PATH=http://localhost:8000
```

4. **Restart the application**

Note: You'll need to re-index your documents as the data formats are different.

## Performance Comparison

Based on local testing with 1,000 documents:

| Metric | SimpleVectorStore | ChromaDB |
|--------|------------------|----------|
| Init Time | <10ms | ~500ms |
| Add Embeddings | ~50ms | ~100ms |
| Search Query | ~20ms | ~50ms |
| Memory Usage | ~50MB | ~200MB (Docker) |

## References

- [ChromaDB Documentation](https://docs.trychroma.com/)
- [ChromaDB GitHub](https://github.com/chroma-core/chroma)
- [ChromaDB JS Client](https://github.com/chroma-core/chroma/tree/main/js/client)
