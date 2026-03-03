#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LABEL="ai.vibe-os.remote-digestion"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
CONTROLLER_ROOT="${HOME}/.vibe-os-controller"
BIN_DIR="${CONTROLLER_ROOT}/bin"
ENV_EXAMPLE_PATH="${CONTROLLER_ROOT}/remote_digestion.env.example"
ENV_PATH="${CONTROLLER_ROOT}/remote_digestion.env"
RUNNER_PATH="${BIN_DIR}/run_remote_digestion.sh"
LOG_DIR="${CONTROLLER_ROOT}/logs"
STDOUT_PATH="${LOG_DIR}/remote_digestion.launchd.out.log"
STDERR_PATH="${LOG_DIR}/remote_digestion.launchd.err.log"
START_INTERVAL="${DIGESTION_START_INTERVAL_SECONDS:-1800}"

mkdir -p "${HOME}/Library/LaunchAgents"
mkdir -p "${BIN_DIR}" "${LOG_DIR}"
: > "${STDOUT_PATH}"
: > "${STDERR_PATH}"

cat > "${ENV_EXAMPLE_PATH}" <<'EOF'
# Remote digestion alert delivery
# Copy this file to ~/.vibe-os-controller/remote_digestion.env and fill the values you need.

# Generic webhook
# DIGESTION_ALERT_WEBHOOK_URL=https://example.com/hooks/vibe-os-digestion
# DIGESTION_ALERT_WEBHOOK_BEARER=replace-with-bearer-token

# Telegram bot
# DIGESTION_ALERT_TELEGRAM_BOT_TOKEN=123456:replace-with-bot-token
# DIGESTION_ALERT_TELEGRAM_CHAT_ID=123456789

# Optional overrides
# DIGESTION_ENABLE_MACOS_NOTIFICATIONS=1
# DIGESTION_ALERT_COOLDOWN_SECONDS=21600
# DIGESTION_SSH_CONNECT_TIMEOUT_SEC=8
EOF

if [ ! -f "${ENV_PATH}" ]; then
  cp "${ENV_EXAMPLE_PATH}" "${ENV_PATH}"
fi

cp "${REPO_ROOT}/scripts/run_remote_digestion.sh" "${BIN_DIR}/run_remote_digestion.sh"
cp "${REPO_ROOT}/scripts/run_remote_digestion.mjs" "${BIN_DIR}/run_remote_digestion.mjs"
cp "${REPO_ROOT}/scripts/digestion_mvp.mjs" "${BIN_DIR}/digestion_mvp.mjs"
cp "${REPO_ROOT}/scripts/check_remote_digestion_status.mjs" "${BIN_DIR}/check_remote_digestion_status.mjs"
chmod +x "${BIN_DIR}/run_remote_digestion.sh"
chmod +x "${BIN_DIR}/check_remote_digestion_status.mjs"

cat > "${PLIST_PATH}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${RUNNER_PATH}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${BIN_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>${START_INTERVAL}</integer>
  <key>StandardOutPath</key>
  <string>${STDOUT_PATH}</string>
  <key>StandardErrorPath</key>
  <string>${STDERR_PATH}</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "${PLIST_PATH}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "${PLIST_PATH}"
launchctl enable "gui/$(id -u)/${LABEL}"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

echo "Installed ${LABEL}"
echo "plist: ${PLIST_PATH}"
echo "controller root: ${CONTROLLER_ROOT}"
echo "env example: ${ENV_EXAMPLE_PATH}"
echo "env file: ${ENV_PATH}"
echo "stdout: ${STDOUT_PATH}"
echo "stderr: ${STDERR_PATH}"
