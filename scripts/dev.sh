#!/bin/bash
# 开发模式：同时启动前端和后端

# 存储子进程 PID
PIDS=()

# 清理函数：杀死所有子进程
cleanup() {
  echo ""
  echo "🛑 正在停止所有服务..."

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

  echo "✅ 所有服务已停止"
  exit 0
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM

# 启动后端
echo "🚀 启动后端 API (端口 3001)..."
npm run dev:server &
SERVER_PID=$!
PIDS+=("$SERVER_PID")

# 启动前端
echo "🚀 启动前端 Vite (端口 5173)..."
npm run dev:client &
CLIENT_PID=$!
PIDS+=("$CLIENT_PID")

# 等待服务启动
sleep 3

# 健康检查
echo ""
echo "🔍 执行健康检查..."

if ! curl -s http://localhost:3001/api/health > /dev/null; then
  echo "❌ 后端启动失败"
  cleanup
fi

if ! curl -s http://localhost:5173 > /dev/null; then
  echo "❌ 前端启动失败"
  cleanup
fi

echo "✅ 所有服务健康检查通过"
echo ""
echo "🌐 服务地址:"
echo "   - 前端: http://localhost:5173"
echo "   - 后端: http://localhost:3001"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待所有子进程（保持运行）
wait
