#!/bin/bash
# 生产环境打包
set -e

echo "🔨 构建前端..."
cd src/client
if ! npm run build; then
  echo "❌ 前端构建失败"
  cd ../..
  exit 1
fi
cd ../..

echo "🔨 构建后端和 CLI..."
if ! npm run build; then
  echo "❌ 后端构建失败"
  exit 1
fi

echo "✅ 打包完成"
