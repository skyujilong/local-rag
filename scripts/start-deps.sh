#!/bin/bash
# 启动依赖服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 启动 Ollama
start_ollama() {
  print_section "启动 Ollama"

  if ! command -v ollama &> /dev/null; then
    print_error "Ollama 未安装"
    echo ""
    echo "📥 安装指南:"
    echo "   macOS:   brew install ollama"
    echo "   Linux:   curl -fsSL https://ollama.com/install.sh | sh"
    echo "   Windows: https://ollama.com/download"
    return 1
  fi

  if curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    print_success "Ollama 已经在运行"
    return 0
  fi

  print_info "启动 Ollama 服务..."

  # 在后台启动 Ollama
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open -a Ollama
    sleep 3
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    ollama serve > /dev/null 2>&1 &
    sleep 3
  else
    print_warning "请手动启动 Ollama: ollama serve"
    return 1
  fi

  # 检查是否启动成功
  if curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    print_success "Ollama 启动成功"

    # 检查并拉取模型
    if ! curl -s http://127.0.0.1:11434/api/tags 2>/dev/null | grep -q "nomic-embed-text"; then
      print_info "拉取嵌入模型 nomic-embed-text..."
      ollama pull nomic-embed-text
      print_success "模型安装完成"
    else
      print_success "嵌入模型已存在"
    fi

    return 0
  else
    print_error "Ollama 启动失败"
    return 1
  fi
}

# 启动 ChromaDB
start_chromadb() {
  print_section "启动 ChromaDB"

  if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
    print_success "ChromaDB 已经在运行"
    return 0
  fi

  if ! command -v docker &> /dev/null; then
    print_error "Docker 未安装，无法启动 ChromaDB"
    echo ""
    echo "📥 安装 Docker: https://docs.docker.com/get-docker/"
    echo ""
    echo "或者使用 Python 启动:"
    echo "   pip install chromadb"
    echo "   chroma-server --port 8000"
    return 1
  fi

  if ! docker info &> /dev/null; then
    print_error "Docker 未运行，请先启动 Docker Desktop"
    return 1
  fi

  print_info "使用 Docker 启动 ChromaDB..."

  # 检查容器是否已存在
  if docker ps -a | grep -q local-rag-chroma; then
    print_info "发现已存在的 ChromaDB 容器，启动中..."
    docker start local-rag-chroma > /dev/null 2>&1
  else
    print_info "拉取并启动 ChromaDB 镜像..."
    docker run -d \
      --name local-rag-chroma \
      -p 8000:8000 \
      --restart unless-stopped \
      chromadb/chroma > /dev/null 2>&1
  fi

  # 等待服务启动
  sleep 3

  # 检查是否启动成功
  if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
    print_success "ChromaDB 启动成功"
    return 0
  else
    print_error "ChromaDB 启动失败"
    docker logs local-rag-chroma --tail 20
    return 1
  fi
}

# 显示服务地址
show_info() {
  print_section "服务地址"

  echo -e "${GREEN}✓${NC} Ollama:    http://127.0.0.1:11434"
  echo -e "${GREEN}✓${NC} ChromaDB:  http://localhost:8000"
  echo ""
  echo "现在可以运行: npm run dev"
}

# 主流程
main() {
  clear
  echo -e "${BLUE}"
  cat << "EOF"
   ____      _ __        __
  / __ \____ (_) /_   ____/ /___ _
 / /_/ / __ \/ / __/  / __  / __ `/
/ _, _/ /_/ / / /_   / /_/ / /_/ /
/_/ |_|\____/_/\__/   \__,_/\__,_/

   依赖服务启动
EOF
  echo -e "${NC}"

  OLLAMA_OK=false
  CHROMA_OK=false

  start_ollama && OLLAMA_OK=true
  start_chromadb && CHROMA_OK=true

  if [ "$OLLAMA_OK" = true ] && [ "$CHROMA_OK" = true ]; then
    show_info
    exit 0
  else
    echo ""
    print_warning "部分服务启动失败，请检查错误信息"
    exit 1
  fi
}

main
