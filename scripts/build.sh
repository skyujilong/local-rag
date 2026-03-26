#!/bin/bash
# 生产环境打包
set -e

echo "🔨 构建前端..."
cd src/client && npm run build && cd ../..

echo "🔨 构建后端和 CLI..."
npm run build

echo "✅ 打包完成"
