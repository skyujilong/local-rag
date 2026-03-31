#!/bin/bash
# 开发模式：检查依赖并启动前端和后端

set -e

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 存储子进程 PID
PIDS=()

# PID 文件 & 日志文件（脚本级常量，避免重复定义）
SERVER_PIDFILE="${TMPDIR:-/tmp}/local-rag-server.pid"
CLIENT_PIDFILE="${TMPDIR:-/tmp}/local-rag-client.pid"
SERVER_LOG="${TMPDIR:-/tmp}/local-rag-server.log"
CLIENT_LOG="${TMPDIR:-/tmp}/local-rag-client.log"

# 依赖状态
OLLAMA_OK=false
CHROMA_OK=false

# 清理标志（防止重复执行）
CLEANUP_DONE=false

# 加载共享库
source "$SCRIPT_DIR/lib/ollama.sh"

# 递归杀死进程树（跨平台兼容 macOS 和 Linux）
kill_tree() {
  local pid=$1
  # 先递归杀死所有子进程
  local children=$(pgrep -P "$pid" 2>/dev/null)
  for child in $children; do
    kill_tree "$child"
  done
  # 再杀死当前进程
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}

# 清理函数：杀死所有子进程
cleanup() {
  # 防止重复执行
  if [ "$CLEANUP_DONE" = true ]; then
    return 0
  fi
  CLEANUP_DONE=true

  echo ""
  echo -e "${YELLOW}🛑 正在停止所有服务...${NC}"

  # 先捕获退出码（必须在 set +e 之前）
  local exit_code=$?
  # 临时禁用 set -e 以防止递归清理
  set +e

  # 杀死所有记录的子进程
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      # 递归杀死子进程树
      kill_tree "$pid"
    fi
  done

  # 通过 PID 文件清理
  if [ -f "$SERVER_PIDFILE" ]; then
    local pid=$(cat "$SERVER_PIDFILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill_tree "$pid"
    fi
    rm -f "$SERVER_PIDFILE"
  fi

  if [ -f "$CLIENT_PIDFILE" ]; then
    local pid=$(cat "$CLIENT_PIDFILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill_tree "$pid"
    fi
    rm -f "$CLIENT_PIDFILE"
  fi

  # 清理 Ollama（如果是我们启动的）
  stop_ollama || true

  echo -e "${GREEN}✅ 所有服务已停止${NC}"

  # 恢复原来的退出状态
  exit $exit_code
}

# 捕获退出信号（包括 EXIT 以处理 set -e 退出的情况）
trap cleanup EXIT SIGINT SIGTERM

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
  if ! check_ollama_installed; then
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
  if check_ollama_running; then
    print_success "Ollama 正在运行"
    OLLAMA_OK=true

    # 检查模型（使用 jq 或精确 grep 匹配）
    if command -v jq &> /dev/null; then
      if curl -s "http://${_ollama_host}:${_ollama_port}/api/tags" 2>/dev/null | \
         jq -e '.models[].name | select(. == "nomic-embed-text")' > /dev/null 2>&1; then
        print_success "模型 nomic-embed-text 已安装"
      else
        print_warning "模型 nomic-embed-text 未安装"
        echo "   运行: ollama pull nomic-embed-text"
      fi
    else
      if curl -s "http://${_ollama_host}:${_ollama_port}/api/tags" 2>/dev/null | \
         grep -q '"nomic-embed-text"'; then
        print_success "模型 nomic-embed-text 已安装"
      else
        print_warning "模型 nomic-embed-text 未安装"
        echo "   运行: ollama pull nomic-embed-text"
      fi
    fi
  else
    print_warning "Ollama 未运行，尝试自动启动..."

    # 使用共享库启动
    if start_ollama; then
      OLLAMA_OK=true
    else
      print_warning "Ollama 自动启动失败"
      echo "   请手动运行: ollama serve"
      echo ""
      return 1
    fi
  fi

  return 0
}

# 检查 ChromaDB
check_chromadb() {
  print_section "检查 ChromaDB"

  # 检查是否运行
  if curl -s http://127.0.0.1:8000/api/v1/heartbeat > /dev/null 2>&1; then
    print_success "ChromaDB 正在运行"
    CHROMA_OK=true
    return 0
  fi

  print_warning "ChromaDB 未运行"

  # 尝试使用 Docker 启动
  if command -v docker &> /dev/null; then
    print_info "尝试使用 Docker 启动 ChromaDB..."

    # 检查容器是否已存在（使用精确匹配）
    if docker ps -a --filter name=^/local-rag-chroma$ --format '{{.Names}}' | grep -q '^local-rag-chroma$'; then
      print_info "发现已存在的 ChromaDB 容器，启动中..."
      if docker start local-rag-chroma > /dev/null 2>&1; then
        # 等待服务就绪
        if wait_for_service "http://127.0.0.1:8000/api/v1/heartbeat"; then
          echo ""
          print_success "ChromaDB Docker 容器已启动（已存在）"
          CHROMA_OK=true
          return 0
        fi
      fi
    else
      print_info "拉取并启动 ChromaDB 镜像..."
      if docker run -d \
        --name local-rag-chroma \
        -p 8000:8000 \
        --restart unless-stopped \
        chromadb/chroma > /dev/null 2>&1; then
        # 等待服务就绪
        if wait_for_service "http://127.0.0.1:8000/api/v1/heartbeat"; then
          echo ""
          print_success "ChromaDB Docker 容器已启动"
          CHROMA_OK=true
          return 0
        fi
      fi
    fi
  fi

  echo ""
  echo "🚀 启动 ChromaDB:"
  echo "   Docker: docker run -d -p 8000:8000 --restart unless-stopped chromadb/chroma"
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

  # 清理旧进程（使用 PID 文件）
  print_info "清理旧进程..."

  # 清理后端进程
  if [ -f "$SERVER_PIDFILE" ]; then
    local old_pid=$(cat "$SERVER_PIDFILE")
    if kill -0 "$old_pid" 2>/dev/null; then
      kill "$old_pid" 2>/dev/null || true
      wait "$old_pid" 2>/dev/null || true
    fi
    rm -f "$SERVER_PIDFILE"
  fi

  # 清理前端进程
  if [ -f "$CLIENT_PIDFILE" ]; then
    local old_pid=$(cat "$CLIENT_PIDFILE")
    if kill -0 "$old_pid" 2>/dev/null; then
      kill "$old_pid" 2>/dev/null || true
      wait "$old_pid" 2>/dev/null || true
    fi
    rm -f "$CLIENT_PIDFILE"
  fi

  # 等待端口释放
  wait_for_port 3001 || true
  wait_for_port 5173 || true

  # 切换到项目根目录
  cd "$PROJECT_ROOT"

  # 启动后端（使用子 shell 后台运行，Ctrl+C 时通过 cleanup 函数终止）
  print_info "启动后端 API (端口 3001)..."
  (pnpm exec tsx watch "$PROJECT_ROOT/src/server/cli.ts" >> "$SERVER_LOG" 2>&1) &
  SERVER_PID=$!
  echo "$SERVER_PID" > "$SERVER_PIDFILE"
  PIDS+=("$SERVER_PID")

  # 启动前端（使用子 shell 后台运行）
  print_info "启动前端 Vite (端口 5173)..."
  (cd "$PROJECT_ROOT/src/client" && pnpm exec vite >> "$CLIENT_LOG" 2>&1) &
  CLIENT_PID=$!
  echo "$CLIENT_PID" > "$CLIENT_PIDFILE"
  PIDS+=("$CLIENT_PID")

  # 等待服务启动（使用健康检查而非固定 sleep）
  echo ""
  print_info "等待服务启动..."

  # 健康检查
  echo ""
  print_section "健康检查"

  if wait_for_service "http://127.0.0.1:3001/api/health"; then
    echo ""
    print_success "后端 API 运行正常"
  else
    echo ""
    print_error "后端启动失败"
    cleanup
  fi

  if wait_for_service "http://127.0.0.1:5173"; then
    echo ""
    print_success "前端 Vite 运行正常"
  else
    echo ""
    print_error "前端启动失败"
    cleanup
  fi
}

# 显示状态摘要
show_summary() {
  print_section "服务状态"

  echo "应用服务:"
  echo -e "   ${GREEN}✓${NC} 前端:  http://127.0.0.1:5173"
  echo -e "   ${GREEN}✓${NC} 后端:  http://127.0.0.1:3001"
  echo ""

  echo "依赖服务:"
  if [ "$OLLAMA_OK" = true ]; then
    echo -e "   ${GREEN}✓${NC} Ollama: http://127.0.0.1:11434"
  else
    echo -e "   ${RED}✗${NC} Ollama: 不可用"
  fi

  if [ "$CHROMA_OK" = true ]; then
    echo -e "   ${GREEN}✓${NC} ChromaDB: http://127.0.0.1:8000"
  else
    echo -e "   ${RED}✗${NC} ChromaDB: 不可用"
  fi

  echo ""
  echo "日志文件:"
  echo -e "   后端: $SERVER_LOG"
  echo -e "   前端: $CLIENT_LOG"
  echo ""
  echo "提示: 使用 npm run logs:follow 查看实时日志"
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
