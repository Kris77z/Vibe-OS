#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Vibe-OS 远程 Mac 一键部署脚本
# 用途：在一台全新的 Mac 上完成 vibe-os 实例的完整部署
# 使用方法：curl 或复制到部署机后执行 bash deploy-remote-mac.sh
# ──────────────────────────────────────────────────────────────

set -euo pipefail

# ── 样式定义 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── 配置常量 ──
VIBE_OS_REPO="https://github.com/Kris77z/Vibe-OS.git"
REQUIRED_NODE_MAJOR=22
OPENCLAW_PORT=18789

# ── 路径规划 ──
INSTANCE_ROOT="$HOME/instances/vibe-os"
WORKSPACE_ROOT="$INSTANCE_ROOT/workspace"
STATE_DIR="$INSTANCE_ROOT/state"
CONFIG_DIR="$INSTANCE_ROOT/config"
CONFIG_PATH="$CONFIG_DIR/openclaw.json"
ENV_PATH="$STATE_DIR/.env"
VIBE_OS_CLONE_DIR="$HOME/Desktop/vibe-os"

# ── 工具函数 ──
info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[  ✓ ]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()    { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

ask_yes_no() {
  local prompt="$1"
  local answer
  while true; do
    echo -en "${BOLD}${prompt} (y/n): ${NC}"
    read -r answer
    case "$answer" in
      [yY]|[yY][eE][sS]) return 0 ;;
      [nN]|[nN][oO])     return 1 ;;
      *) echo "请输入 y 或 n" ;;
    esac
  done
}

read_env_value() {
  local key="$1"
  local file="$2"
  if [ -f "$file" ]; then
    awk -F= -v target="$key" '$1 == target { sub(/^[^=]*=/, ""); print; exit }' "$file"
  fi
}

# ── 欢迎 ──
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║     Vibe-OS 远程 Mac 一键部署脚本               ║"
echo "║     把你的个人 AI 大脑安家到这台 Mac             ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "本脚本将依次完成："
echo "  1. 检查并安装 Node.js (v${REQUIRED_NODE_MAJOR}+)"
echo "  2. 安装 OpenClaw CLI"
echo "  3. 克隆或快进更新 vibe-os 仓库"
echo "  4. 初始化实例目录结构（不覆盖已有实例数据）"
echo "  5. 配置密钥"
echo "  6. 检查并构建 Docker 沙盒镜像（必需）"
echo ""

if ! ask_yes_no "准备好了吗？开始部署"; then
  echo "已取消。"
  exit 0
fi

echo ""

# ══════════════════════════════════════════════════════
# 阶段 1：Node.js
# ══════════════════════════════════════════════════════
info "阶段 1/6：检查 Node.js ..."

install_node_with_nvm() {
  info "正在通过 nvm 安装 Node.js v${REQUIRED_NODE_MAJOR} ..."
  if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  fi
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install "$REQUIRED_NODE_MAJOR"
  nvm use "$REQUIRED_NODE_MAJOR"
  nvm alias default "$REQUIRED_NODE_MAJOR"
}

# 尝试加载 nvm（如果已存在）
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null || true

if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -ge "$REQUIRED_NODE_MAJOR" ]; then
    success "Node.js $(node -v) 已就绪"
  else
    warn "当前 Node.js 版本 $(node -v) 低于 v${REQUIRED_NODE_MAJOR}"
    install_node_with_nvm
    success "Node.js $(node -v) 安装完成"
  fi
else
  warn "未检测到 Node.js"
  install_node_with_nvm
  success "Node.js $(node -v) 安装完成"
fi

# ══════════════════════════════════════════════════════
# 阶段 2：OpenClaw CLI
# ══════════════════════════════════════════════════════
info "阶段 2/6：检查 OpenClaw ..."

if command -v openclaw &>/dev/null; then
  success "OpenClaw 已安装：$(openclaw --version 2>/dev/null || echo '版本未知')"
else
  info "正在安装 OpenClaw ..."
  npm install -g openclaw@latest
  if command -v openclaw &>/dev/null; then
    success "OpenClaw 安装成功"
  else
    fail "OpenClaw 安装失败，请检查网络或手动执行: npm install -g openclaw@latest"
  fi
fi

# ══════════════════════════════════════════════════════
# 阶段 3：克隆 vibe-os 仓库
# ══════════════════════════════════════════════════════
info "阶段 3/6：获取 vibe-os 代码 ..."

if [ -d "$VIBE_OS_CLONE_DIR/.git" ]; then
  info "vibe-os 仓库已存在，正在检查本地状态 ..."
  cd "$VIBE_OS_CLONE_DIR"
  if [ -n "$(git status --porcelain)" ]; then
    fail "现有仓库包含未提交修改：$VIBE_OS_CLONE_DIR。请先提交或清理后再重试。"
  fi
  GIT_TERMINAL_PROMPT=0 git fetch --prune --progress origin main
  git merge --ff-only FETCH_HEAD
  success "代码已快进到 origin/main"
else
  info "正在克隆 vibe-os 仓库到 $VIBE_OS_CLONE_DIR ..."
  git clone "$VIBE_OS_REPO" "$VIBE_OS_CLONE_DIR"
  success "仓库克隆完成"
fi

# ══════════════════════════════════════════════════════
# 阶段 4：初始化实例目录
# ══════════════════════════════════════════════════════
info "阶段 4/6：初始化实例目录 ..."

BOOTSTRAP_SCRIPT="$VIBE_OS_CLONE_DIR/scripts/bootstrap-vibe-os-instance.sh"

if [ ! -f "$BOOTSTRAP_SCRIPT" ]; then
  fail "找不到初始化脚本：$BOOTSTRAP_SCRIPT"
fi

bash "$BOOTSTRAP_SCRIPT" \
  --instance-root "$INSTANCE_ROOT" \
  --workspace-root "$WORKSPACE_ROOT"

# 修正配置文件中的路径
if [ -f "$CONFIG_PATH" ]; then
  sed -i '' "s|/Users/openclaw-svc|$HOME|g" "$CONFIG_PATH"
  success "配置文件路径已修正为当前用户: $HOME"
else
  fail "配置文件不存在：$CONFIG_PATH"
fi

success "实例目录初始化完成"

# ══════════════════════════════════════════════════════
# 阶段 5：配置密钥
# ══════════════════════════════════════════════════════
info "阶段 5/6：配置密钥 ..."

EXISTING_GATEWAY_TOKEN="$(read_env_value "OPENCLAW_GATEWAY_TOKEN" "$ENV_PATH")"
EXISTING_OPENAI_KEY="$(read_env_value "OPENAI_AUTH_KEY" "$ENV_PATH")"

if [ -n "$EXISTING_GATEWAY_TOKEN" ]; then
  GATEWAY_TOKEN="$EXISTING_GATEWAY_TOKEN"
  success "复用已有 Gateway Token"
else
  GATEWAY_TOKEN=$(openssl rand -hex 32)
  success "已自动生成 Gateway Token"
fi

if [ -n "$EXISTING_OPENAI_KEY" ]; then
  OPENAI_KEY="$EXISTING_OPENAI_KEY"
  success "复用已有 OPENAI_AUTH_KEY"
else
  echo ""
  echo -e "${BOLD}现在需要你输入 AI 模型的鉴权密钥（OPENAI_AUTH_KEY）${NC}"
  echo "这是你用来调用 GPT 模型的那个密钥。"
  echo -en "${BOLD}请粘贴你的 OPENAI_AUTH_KEY: ${NC}"
  read -r OPENAI_KEY

  if [ -z "$OPENAI_KEY" ]; then
    warn "你没有输入密钥，将使用占位符。部署后请手动编辑: $ENV_PATH"
    OPENAI_KEY="replace-with-openai-relay-auth-key"
  fi
fi

# 写入 .env 文件
cat > "$ENV_PATH" <<EOF
OPENCLAW_GATEWAY_TOKEN=${GATEWAY_TOKEN}
OPENAI_AUTH_KEY=${OPENAI_KEY}
# OPENAI_BASE_URL=https://ai.co.link/openai/v1
EOF

success "密钥已写入 $ENV_PATH"

# 保存 Token 到临时文件方便后续测试
TOKEN_FILE="$STATE_DIR/.gateway_token_for_test"
echo "$GATEWAY_TOKEN" > "$TOKEN_FILE"

# ══════════════════════════════════════════════════════
# 阶段 6：Docker 沙盒（必需）
# ══════════════════════════════════════════════════════
info "阶段 6/6：检查 Docker 沙盒 ..."

SANDBOX_READY=0
DEFAULT_SANDBOX_IMAGE="openclaw-sandbox:bookworm-slim"
if command -v docker &>/dev/null; then
  if docker info &>/dev/null 2>&1; then
    success "Docker 正在运行"
    # 检查沙盒镜像是否已存在
    if docker image inspect "$DEFAULT_SANDBOX_IMAGE" &>/dev/null 2>&1; then
      success "沙盒镜像 $DEFAULT_SANDBOX_IMAGE 已存在"
      SANDBOX_READY=1
    else
      info "沙盒镜像不存在，先按 OpenClaw 默认逻辑补齐 ..."
      if docker pull debian:bookworm-slim && docker tag debian:bookworm-slim "$DEFAULT_SANDBOX_IMAGE"; then
        success "已通过 debian:bookworm-slim 补齐 $DEFAULT_SANDBOX_IMAGE"
        SANDBOX_READY=1
      else
        warn "默认镜像补齐失败，尝试使用仓库内的 sandbox 构建脚本 ..."
        OPENCLAW_SANDBOX_SCRIPT="$VIBE_OS_CLONE_DIR/openclaw/scripts/sandbox-setup.sh"
        if [ -f "$OPENCLAW_SANDBOX_SCRIPT" ]; then
          bash "$OPENCLAW_SANDBOX_SCRIPT" && SANDBOX_READY=1
        else
          fail "未找到 sandbox 构建脚本：$OPENCLAW_SANDBOX_SCRIPT"
        fi
      fi
    fi
  else
    fail "Docker 已安装但未运行，请先启动 Docker Desktop 再重试。"
  fi
else
  fail "未检测到 Docker。当前部署要求启用 OpenClaw sandbox，不能继续。"
fi

if [ "$SANDBOX_READY" -eq 0 ]; then
  fail "Docker 沙盒镜像未就绪，部署不能继续。"
fi

# ══════════════════════════════════════════════════════
# 完成！输出部署摘要
# ══════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            🎉 部署准备完成!                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}部署摘要：${NC}"
echo "  实例根目录 : $INSTANCE_ROOT"
echo "  工作区     : $WORKSPACE_ROOT"
echo "  状态目录   : $STATE_DIR"
echo "  配置文件   : $CONFIG_PATH"
echo "  密钥文件   : $ENV_PATH"
echo "  Gateway端口: $OPENCLAW_PORT"
echo ""
echo -e "${BOLD}你的 Gateway Token（请保管好，连接 Raycast 或其它客户端时需要）：${NC}"
echo -e "  ${YELLOW}${GATEWAY_TOKEN}${NC}"
echo ""
echo -e "${BOLD}下一步操作：${NC}"
echo ""
echo "  ${CYAN}1. 前台启动验证（在本终端执行）：${NC}"
echo ""
echo "     OPENCLAW_PROFILE=vibe-os \\"
echo "     OPENCLAW_STATE_DIR=$STATE_DIR \\"
echo "     OPENCLAW_CONFIG_PATH=$CONFIG_PATH \\"
echo "     openclaw gateway --port $OPENCLAW_PORT"
echo ""
echo "  ${CYAN}2. 打开新终端，检查健康状态：${NC}"
echo ""
echo "     OPENCLAW_PROFILE=vibe-os \\"
echo "     OPENCLAW_STATE_DIR=$STATE_DIR \\"
echo "     OPENCLAW_CONFIG_PATH=$CONFIG_PATH \\"
echo "     openclaw gateway status"
echo ""
echo "  ${CYAN}3. 验证通过后，安装后台服务：${NC}"
echo ""
echo "     OPENCLAW_PROFILE=vibe-os \\"
echo "     OPENCLAW_STATE_DIR=$STATE_DIR \\"
echo "     OPENCLAW_CONFIG_PATH=$CONFIG_PATH \\"
echo "     openclaw gateway install --force"
echo ""
echo "  ${CYAN}4. 在你的主力 Mac 的 Raycast 或其它客户端中配置：${NC}"
echo ""
echo "     Gateway Base URL: http://127.0.0.1:${OPENCLAW_PORT}  (通过 SSH tunnel)"
echo "     Gateway Token:    （上面显示的那串）"
echo "     Agent ID:         main"
echo ""
echo "  ${CYAN}5. 由于 gateway.bind=loopback，远程访问请先建立隧道：${NC}"
echo ""
echo "     ssh -N -L ${OPENCLAW_PORT}:127.0.0.1:${OPENCLAW_PORT} <user>@<remote-mac>"
echo ""
echo -e "${GREEN}──────────────────────────────────────────────────${NC}"
