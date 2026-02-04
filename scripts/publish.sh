#!/bin/bash

# 严格模式：任何命令失败立即退出
set -euo pipefail

# ============ 颜色定义 ============
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============ 日志函数 ============
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# ============ 变量定义 ============
ROOT="$(pwd)"
DEPLOY_SUCCESS=false
DEPLOY_TAG=""

# ============ 清理函数 ============
cleanup() {
  log_info "清理临时目录..."
  /bin/rm -rf "${ROOT}/dist" "${ROOT}/dist-remote"
  
  if [ "$DEPLOY_SUCCESS" = true ]; then
    log_success "部署完成！标签: release/${DEPLOY_TAG}"
  else
    log_error "部署失败，已清理临时文件"
  fi
}

# 捕获退出信号，确保清理函数执行
trap cleanup EXIT

# ============ 主逻辑 ============

log_info "清理旧的构建目录..."
/bin/rm -rf "${ROOT}/dist" "${ROOT}/dist-remote"

log_info "开始构建项目..."
pnpm run build

if [ ! -d "${ROOT}/dist" ] || [ -z "$(ls -A "${ROOT}/dist")" ]; then
  log_error "dist 目录为空或不存在"
  exit 1
fi
log_success "构建完成"

log_info "克隆 gh-pages 分支..."
if ! git clone --depth 1 --branch gh-pages git@github.com-vreese:Elements-Studio/native-bridge-ui.git "${ROOT}/dist-remote"; then
  log_error "克隆 gh-pages 分支失败"
  exit 1
fi

cd "${ROOT}/dist-remote" || { log_error "无法进入 dist-remote 目录"; exit 1; }
log_info "清理 gh-pages 分支内容..."
/bin/rm -rf ./*

cd "${ROOT}" || { log_error "无法返回项目根目录"; exit 1; }
log_info "复制构建文件到 dist-remote..."
cp -r dist/* dist-remote/

cd "${ROOT}/dist-remote" || { log_error "无法进入 dist-remote 目录"; exit 1; }

git config commit.gpgsign false
cp index.html 404.html
git add .

DEPLOY_TIME=$(date +"%Y-%m-%d %H:%M:%S")
DEPLOY_TAG=$(date +"%Y-%m-%d_%H-%M-%S")

log_info "提交并推送到 GitHub Pages..."
git commit -m "Deploy to GitHub Pages - ${DEPLOY_TIME}"
git push --set-upstream origin gh-pages

cd "${ROOT}" || { log_error "无法返回项目根目录"; exit 1; }

log_info "创建并推送发布标签..."
git tag "release/${DEPLOY_TAG}"
git push origin "release/${DEPLOY_TAG}"

# 标记部署成功
DEPLOY_SUCCESS=true
