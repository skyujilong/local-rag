#!/bin/bash
# 安装所有项目依赖
set -e

# 检测并使用包管理器（优先 pnpm）
if command -v pnpm &> /dev/null; then
  PKG_MANAGER="pnpm"
elif command -v npm &> /dev/null; then
  PKG_MANAGER="npm"
else
  echo "❌ 未找到 pnpm 或 npm，请先安装 Node.js"
  exit 1
fi

echo "📦 使用 $PKG_MANAGER 安装根目录依赖..."
$PKG_MANAGER install

echo "📦 使用 $PKG_MANAGER 安装前端依赖..."
cd src/client && $PKG_MANAGER install && cd ../..

echo "✅ 依赖安装完成"
