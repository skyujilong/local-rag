#!/bin/bash

# Ollama Connection Checker and Troubleshooter
# This script checks if Ollama is running and helps diagnose connection issues

set -e

echo "🔍 Checking Ollama connection..."
echo ""

OLLAMA_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-nomic-embed-text}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Ollama is running
echo "1. Testing connection to Ollama at $OLLAMA_URL..."
if curl -s --connect-timeout 5 "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Ollama is running${NC}"
else
    echo -e "${RED}✗ Cannot connect to Ollama${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "  1. Install Ollama: https://ollama.com/download"
    echo "  2. Start Ollama: ollama serve"
    echo "  3. Verify installation: which ollama"
    exit 1
fi

echo ""

# Check if the model is available
echo "2. Checking if model '$OLLAMA_MODEL' is available..."
MODELS=$(curl -s "$OLLAMA_URL/api/tags")

if echo "$MODELS" | grep -q "$OLLAMA_MODEL"; then
    echo -e "${GREEN}✓ Model '$OLLAMA_MODEL' is installed${NC}"
else
    echo -e "${YELLOW}⚠ Model '$OLLAMA_MODEL' not found${NC}"
    echo ""
    echo "Available models:"
    echo "$MODELS" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || echo "  No models found"
    echo ""
    echo "To install the required model:"
    echo "  ollama pull $OLLAMA_MODEL"
    exit 1
fi

echo ""

# Test embedding generation
echo "3. Testing embedding generation..."
RESPONSE=$(curl -s -X POST "$OLLAMA_URL/api/embeddings" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$OLLAMA_MODEL\",\"prompt\":\"test\"}")

if echo "$RESPONSE" | grep -q "embedding"; then
    DIMENSION=$(echo "$RESPONSE" | grep -o '"embedding":\[[^]]*\]' | grep -o ',' | wc -l | tr -d ' ')
    DIMENSION=$((DIMENSION + 1))
    echo -e "${GREEN}✓ Embedding generation works (dimension: $DIMENSION)${NC}"
else
    echo -e "${RED}✗ Embedding generation failed${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ All checks passed! Ollama is ready to use.${NC}"
echo ""
echo "Configuration:"
echo "  URL: $OLLAMA_URL"
echo "  Model: $OLLAMA_MODEL"
echo "  Dimension: $DIMENSION"
