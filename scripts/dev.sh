#!/bin/bash
# 开发模式：检查依赖并启动前端和后端

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 存储子进程 PID
PIDS=()

# 依赖状态
OLLAMA_OK=false
CHROMA_OK=false

# 清理函数：杀死所有子进程
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 正在停止所有服务...${NC}"

  # 杀死所有记录的子进程
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
    fi
  done

  # 额外清理：杀死可能遗留的 node/tsx 进程
  pkill -f "tsx watch src/server/cli.ts" 2>/dev/null
  pkill -f "vite.*src/client" 2>/dev/null

  echo -e "${GREEN}✅ 所有服务已停止${NC}"
  exit 0
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM

# 打印带颜色的消息
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

# 检查 Ollama
check_ollama() {
  print_section "检查 Ollama"

  # 检查是否安装
  if ! command -v ollama &> /dev/null; then
    print_error "Ollama 未安装"
    echo ""
    echo "📥 安装指南:"
    echo "   macOS:   brew install ollama"
    echo "   Linux:   curl -fsSL https://ollama.com/install.sh | sh"
    echo "   Windows: https://ollama.com/download"
    echo ""
    echo "安装后运行: ollama serve"
    return 1
  fi

  print_success "Ollama 已安装"

  # 检查是否运行
  if curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    print_success "Ollama 正在运行"
    OLLAMA_OK=true

    # 检查模型
    if curl -s http://127.0.0.1:11434/api/tags 2>/dev/null | grep -q "nomic-embed-text"; then
      print_success "模型 nomic-embed-text 已安装"
    else
      print_warning "模型 nomic-embed-text 未安装"
      echo "   运行: ollama pull nomic-embed-text"
    fi
  else
    print_warning "Ollama 未运行"
    echo ""
    echo "🚀 启动 Ollama:"
    echo "   终端 1: ollama serve"
    echo "   终端 2: ollama pull nomic-embed-text"
    echo ""
    return 1
  fi

  return 0
}

# 检查 ChromaDB
check_chromadb() {
  print_section "检查 ChromaDB"

  # 检查是否运行
  if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
    print_success "ChromaDB 正在运行"
    CHROMA_OK=true
    return 0
  fi

  print_warning "ChromaDB 未运行"

  # 尝试使用 Docker 启动
  if command -v docker &> /dev/null; then
    print_info "尝试使用 Docker 启动 ChromaDB..."
    if docker run -d -p 8000:8000 --name local-rag-chroma chromadb/chroma > /dev/null 2>&1; then
      print_success "ChromaDB Docker 容器已启动"
      CHROMA_OK=true
      sleep 2
      return 0
    else
      # 可能容器已存在，尝试启动
      if docker start local-rag-chroma > /dev/null 2>&1; then
        print_success "ChromaDB Docker 容器已启动（已存在）"
        CHROMA_OK=true
        return 0
      fi
    fi
  fi

  echo ""
  echo "🚀 启动 ChromaDB:"
  echo "   Docker: docker run -d -p 8000:8000 chromadb/chroma"
  echo "   Python: pip install chromadb && chroma-server --port 8000"
  echo ""
  return 1
}

# 询问用户是否继续
ask_continue() {
  if [ "$OLLAMA_OK" = false ] || [ "$CHROMA_OK" = false ]; then
    echo ""
    print_warning "部分依赖服务不可用，应用将以降级模式运行"
    echo "   - 没有 Ollama: 无法使用嵌入功能"
    echo "   - 没有 ChromaDB: 无法使用向量存储"
    echo ""
    read -p "是否继续启动？(y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      print_info "已取消启动"
      exit 0
    fi
  fi
}

# 启动应用服务
start_services() {
  print_section "启动应用服务"

  # 启动后端
  print_info "启动后端 API (端口 3001)..."
  npm run dev:server &
  SERVER_PID=$!
  PIDS+=("$SERVER_PID")

  # 启动前端
  print_info "启动前端 Vite (端口 5173)..."
  npm run dev:client &
  CLIENT_PID=$!
  PIDS+=("$CLIENT_PID")

  # 等待服务启动
  sleep 3

  # 健康检查
  echo ""
  print_section "健康检查"

  if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    print_success "后端 API 运行正常"
  else
    print_error "后端启动失败"
    cleanup
  fi

  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    print_success "前端 Vite 运行正常"
  else
    print_error "前端启动失败"
    cleanup
  fi
}

# 显示状态摘要
show_summary() {
  print_section "服务状态"

  echo "应用服务:"
  echo -e "   ${GREEN}✓${NC} 前端:  http://localhost:5173"
  echo -e "   ${GREEN}✓${NC} 后端:  http://localhost:3001"
  echo ""

  echo "依赖服务:"
  if [ "$OLLAMA_OK" = true ]; then
    echo -e "   ${GREEN}✓${NC} Ollama: http://localhost:11434"
  else
    echo -e "   ${RED}✗${NC} Ollama: 不可用"
  fi

  if [ "$CHROMA_OK" = true ]; then
    echo -e "   ${GREEN}✓${NC} ChromaDB: http://localhost:8000"
  else
    echo -e "   ${RED}✗${NC} ChromaDB: 不可用"
  fi

  echo ""
  echo "按 Ctrl+C 停止所有服务"
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

EOF
  echo -e "${NC}"

  check_ollama || true
  check_chromadb || true
  ask_continue
  start_services
  show_summary

  # 等待所有子进程（保持运行）
  wait
}

main
