#!/bin/bash
# 启动生产环境

# 检查是否已构建
if [ ! -d dist ]; then
  echo "❌ 未找到构建输出，请先运行 npm run build"
  exit 1
fi

# 启动服务
node dist/cli.js "$@"
