#!/bin/bash
# 设置环境变量
if [ ! -f .env ]; then
  echo "📝 创建 .env 文件..."
  cp .env.example .env
  echo "✅ .env 已创建，请根据需要修改配置"
else
  echo "⚠️  .env 已存在，跳过"
fi
