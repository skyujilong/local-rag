#!/bin/bash
# Shared Ollama management library

# Ollama configuration (with namespace prefix to avoid conflicts)
_ollama_port=11434
_ollama_host="127.0.0.1"
_ollama_log="${TMPDIR:-/tmp}/local-rag-ollama.log"
_ollama_pidfile="${TMPDIR:-/tmp}/local-rag-ollama.pid"

# Allow override via environment variables
: "${_ollama_port:=${OLLAMA_PORT:-11434}}"
: "${_ollama_host:=${OLLAMA_HOST:-127.0.0.1}}"
: "${_ollama_wait_max_attempts:=${OLLAMA_WAIT_MAX_ATTEMPTS:-30}}"
: "${_ollama_wait_interval:=${OLLAMA_WAIT_INTERVAL:-0.5}}"

# Wait for port to be available
wait_for_port() {
  local port=$1
  local max_attempts=${2:-20}
  local sleep_interval=${3:-${_ollama_wait_interval}}
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if ! lsof -i ":$port" > /dev/null 2>&1; then
      return 0
    fi
    if [ $attempt -eq 1 ]; then
      echo -n "等待端口 $port 释放..."
    fi
    echo -n "."
    sleep "$sleep_interval"
    attempt=$((attempt + 1))
  done
  echo ""
  return 1
}

# Wait for service to be ready
wait_for_service() {
  local url=$1
  local max_attempts=${2:-${_ollama_wait_max_attempts}}
  local sleep_interval=${3:-${_ollama_wait_interval}}
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if curl -s "$url" > /dev/null 2>&1; then
      return 0
    fi
    if [ $attempt -eq 1 ]; then
      echo -n "等待服务就绪..."
    fi
    echo -n "."
    sleep "$sleep_interval"
    attempt=$((attempt + 1))
  done
  echo ""
  return 1
}

# Check if Ollama is installed
check_ollama_installed() {
  if ! command -v ollama &> /dev/null; then
    return 1
  fi
  return 0
}

# Check if Ollama is running
check_ollama_running() {
  if curl -s "http://${_ollama_host}:${_ollama_port}/api/tags" > /dev/null 2>&1; then
    return 0
  fi
  return 1
}

# Start Ollama service
start_ollama() {
  local using_gui=false

  # Check if already running
  if check_ollama_running; then
    echo "Ollama 已经在运行"
    return 0
  fi

  echo "启动 Ollama 服务..."

  # Start based on platform
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS: 优先尝试 GUI App
    if [ -d "/Applications/Ollama.app" ]; then
      open -a Ollama
      using_gui=true
    else
      # Fallback to command line
      nohup ollama serve > "$_ollama_log" 2>&1 &
      echo $! > "$_ollama_pidfile"
    fi
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux: command line only
    nohup ollama serve > "$_ollama_log" 2>&1 &
    echo $! > "$_ollama_pidfile"
  else
    echo "不支持的操作系统，请手动启动: ollama serve" >&2
    return 1
  fi

  # Wait for service to be ready
  if wait_for_service "http://${_ollama_host}:${_ollama_port}/api/tags"; then
    echo ""
    echo "Ollama 启动成功"
    return 0
  else
    echo ""
    echo "Ollama 启动失败" >&2
    if [ -f "$_ollama_log" ]; then
      echo "查看日志: cat $_ollama_log" >&2
    fi
    return 1
  fi
}

# Stop Ollama service
stop_ollama() {
  if [ -f "$_ollama_pidfile" ]; then
    local pid=$(cat "$_ollama_pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null || true
    fi
    rm -f "$_ollama_pidfile"
  fi

  # Wait for port to be released
  wait_for_port "$_ollama_port"
}

# Check and pull model if needed
ensure_model() {
  local model=$1

  # Use jq for precise JSON matching, fallback to grep with quotes
  if command -v jq &> /dev/null; then
    if curl -s "http://${_ollama_host}:${_ollama_port}/api/tags" 2>/dev/null | \
       jq -e ".models[].name | select(. == \"$model\")" > /dev/null 2>&1; then
      echo "模型 $model 已存在"
      return 0
    fi
  else
    # Fallback: grep with quoted model name for precise matching
    if curl -s "http://${_ollama_host}:${_ollama_port}/api/tags" 2>/dev/null | \
       grep -q "\"$model\""; then
      echo "模型 $model 已存在"
      return 0
    fi
  fi

  echo "拉取模型 $model..."
  if ollama pull "$model"; then
    echo "模型安装完成"
    return 0
  else
    echo "模型安装失败" >&2
    return 1
  fi
}

# Get Ollama status info
get_ollama_info() {
  echo "Ollama: http://${_ollama_host}:${_ollama_port}"
  if [ -f "$_ollama_log" ]; then
    echo "日志: $_ollama_log"
  fi
}
