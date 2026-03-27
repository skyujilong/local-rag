#!/bin/bash

# Test script to verify ChromaDB configuration

echo "🔍 Testing ChromaDB Configuration..."
echo ""

# Check 1: Verify config file changes
echo "✓ Check 1: Verifying config.ts..."
if grep -q "http://localhost:8000" src/shared/utils/config.ts; then
    echo "  ✅ Config uses HTTP URL"
else
    echo "  ❌ Config still uses file path"
    exit 1
fi

# Check 2: Verify vectorstore.ts imports ChromaClient
echo "✓ Check 2: Verifying vectorstore.ts imports..."
if grep -q "import { ChromaClient, Collection } from 'chromadb'" src/server/services/vectorstore.ts; then
    echo "  ✅ ChromaDB imports present"
else
    echo "  ❌ ChromaDB imports missing"
    exit 1
fi

# Check 3: Verify documentation exists
echo "✓ Check 3: Verifying documentation..."
if [ -f "CHROMADB_SETUP.md" ]; then
    echo "  ✅ Setup guide exists"
else
    echo "  ❌ Setup guide missing"
    exit 1
fi

# Check 4: Test ChromaDB client initialization
echo "✓ Check 4: Testing ChromaDB client init..."
node -e "
const { ChromaClient } = require('chromadb');
try {
  const client = new ChromaClient({ path: 'http://localhost:8000' });
  console.log('  ✅ ChromaDB client can be initialized');
  process.exit(0);
} catch (e) {
  console.log('  ❌ ChromaDB client init failed:', e.message);
  process.exit(1);
}
" || exit 1

# Check 5: Verify .env.example
echo "✓ Check 5: Verifying .env.example..."
if grep -q "CHROMA_PATH=http://localhost:8000" .env.example; then
    echo "  ✅ .env.example updated"
else
    echo "  ❌ .env.example not updated"
    exit 1
fi

echo ""
echo "🎉 All checks passed!"
echo ""
echo "📝 Next steps:"
echo "   1. Start ChromaDB server: docker run -p 8000:8000 chromadb/chroma"
echo "   2. Or use SimpleVectorStore (default, no server needed)"
echo "   3. See CHROMADB_SETUP.md for detailed instructions"
echo ""
