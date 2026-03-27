#!/bin/bash
# 检查依赖服务状态

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  依赖服务检查${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查 Ollama
echo -e "${BLUE}Ollama:${NC}"
if command -v ollama &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} 已安装: $(which ollama)"
  if curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} 运行中: http://127.0.0.1:11434"

    # 检查模型
    MODELS=$(curl -s http://127.0.0.1:11434/api/tags 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$MODELS" ]; then
      echo -e "  ${GREEN}✓${NC} 已安装模型:"
      echo "$MODELS" | while read -r model; do
        echo "     - $model"
      done
    fi
  else
    echo -e "  ${YELLOW}⚠${NC} 未运行"
    echo "     启动: ollama serve"
  fi
else
  echo -e "  ${RED}✗${NC} 未安装"
  echo "     安装: brew install ollama (macOS)"
  echo "           curl -fsSL https://ollama.com/install.sh | sh (Linux)"
fi

echo ""

# 检查 ChromaDB
echo -e "${BLUE}ChromaDB:${NC}"
if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} 运行中: http://localhost:8000"
else
  echo -e "  ${YELLOW}⚠${NC} 未运行"
  echo "     启动: docker run -d -p 8000:8000 chromadb/chroma"
fi

echo ""

# 检查 Docker
echo -e "${BLUE}Docker:${NC}"
if command -v docker &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} 已安装: $(docker --version | cut -d' ' -f3)"
  if docker info &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} 运行中"
  else
    echo -e "  ${YELLOW}⚠${NC} 未运行（需要启动 Docker Desktop）"
  fi
else
  echo -e "  ${RED}✗${NC} 未安装"
  echo "     安装: https://docs.docker.com/get-docker/"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
