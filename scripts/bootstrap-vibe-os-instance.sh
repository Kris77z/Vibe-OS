#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/bootstrap-vibe-os-instance.sh [--instance-root PATH] [--workspace-root PATH]

Purpose:
  Prepare the directory layout and starter files for the project-scoped
  vibe-os OpenClaw instance on the deployment Mac.

Options:
  --instance-root PATH   Root directory for the vibe-os instance
  --workspace-root PATH  Workspace directory to use for vibe-os
  --force                Overwrite starter config and env template
  -h, --help             Show this help
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

INSTANCE_ROOT="${HOME}/instances/vibe-os"
WORKSPACE_ROOT=""
FORCE=0

normalize_path() {
  local target="$1"
  local parent
  parent="$(dirname "${target}")"
  mkdir -p "${parent}"
  (
    cd "${parent}"
    printf '%s/%s\n' "$(pwd)" "$(basename "${target}")"
  )
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --instance-root)
      INSTANCE_ROOT="$2"
      shift 2
      ;;
    --workspace-root)
      WORKSPACE_ROOT="$2"
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

INSTANCE_ROOT="$(normalize_path "${INSTANCE_ROOT}")"

if [[ -z "${WORKSPACE_ROOT}" ]]; then
  WORKSPACE_ROOT="${INSTANCE_ROOT}/workspace"
fi
WORKSPACE_ROOT="$(normalize_path "${WORKSPACE_ROOT}")"

STATE_DIR="${INSTANCE_ROOT}/state"
CONFIG_DIR="${INSTANCE_ROOT}/config"
CONFIG_PATH="${CONFIG_DIR}/openclaw.json"
ENV_PATH="${STATE_DIR}/.env"
LOGS_DIR="${STATE_DIR}/logs"

CONFIG_TEMPLATE="${REPO_ROOT}/docs/openclaw.vibe-os.instance.example.json5"
MANIFEST_TEMPLATE="${REPO_ROOT}/docs/instances/vibe-os.instance.yaml"

mkdir -p \
  "${INSTANCE_ROOT}" \
  "${WORKSPACE_ROOT}" \
  "${WORKSPACE_ROOT}/memory/knowledge" \
  "${STATE_DIR}" \
  "${STATE_DIR}/logs" \
  "${CONFIG_DIR}"

copy_if_missing() {
  local src="$1"
  local dest="$2"
  if [[ -e "${dest}" && "${FORCE}" -ne 1 ]]; then
    return 0
  fi
  cp "${src}" "${dest}"
}

copy_if_missing "${CONFIG_TEMPLATE}" "${CONFIG_PATH}"
copy_if_missing "${MANIFEST_TEMPLATE}" "${INSTANCE_ROOT}/vibe-os.instance.yaml"

if [[ ! -e "${ENV_PATH}" || "${FORCE}" -eq 1 ]]; then
  cat > "${ENV_PATH}" <<'EOF'
OPENCLAW_GATEWAY_TOKEN=replace-with-long-random-token
OPENAI_AUTH_KEY=replace-with-openai-relay-auth-key
# OPENAI_BASE_URL=https://ai.co.link/openai/v1
EOF
fi

if [[ "${WORKSPACE_ROOT}" != "${REPO_ROOT}" ]]; then
  if [[ -f "${REPO_ROOT}/AGENTS.md" && (! -e "${WORKSPACE_ROOT}/AGENTS.md" || "${FORCE}" -eq 1) ]]; then
    cp "${REPO_ROOT}/AGENTS.md" "${WORKSPACE_ROOT}/AGENTS.md"
  fi
  if [[ -f "${REPO_ROOT}/MEMORY.md" && (! -e "${WORKSPACE_ROOT}/MEMORY.md" || "${FORCE}" -eq 1) ]]; then
    cp "${REPO_ROOT}/MEMORY.md" "${WORKSPACE_ROOT}/MEMORY.md"
  fi
  if [[ -d "${REPO_ROOT}/memory" && (! -e "${WORKSPACE_ROOT}/memory/.bootstrapped" || "${FORCE}" -eq 1) ]]; then
    mkdir -p "${WORKSPACE_ROOT}/memory"
    cp -R "${REPO_ROOT}/memory/." "${WORKSPACE_ROOT}/memory/"
    touch "${WORKSPACE_ROOT}/memory/.bootstrapped"
  fi
fi

for file in \
  "${WORKSPACE_ROOT}/AGENTS.md" \
  "${WORKSPACE_ROOT}/MEMORY.md" \
  "${WORKSPACE_ROOT}/memory/braindump.md" \
  "${WORKSPACE_ROOT}/memory/mission_log.md"; do
  if [[ ! -e "${file}" ]]; then
    touch "${file}"
  fi
done

cat <<EOF
Prepared vibe-os instance layout:

  instance root : ${INSTANCE_ROOT}
  workspace     : ${WORKSPACE_ROOT}
  state dir     : ${STATE_DIR}
  config path   : ${CONFIG_PATH}
  env file      : ${ENV_PATH}
  logs dir      : ${LOGS_DIR}

Next:
  1. Sync the vibe-os workspace contents into:
     ${WORKSPACE_ROOT}
  2. Edit:
     ${CONFIG_PATH}
     ${ENV_PATH}
  3. Run OpenClaw with:
     OPENCLAW_PROFILE=vibe-os \\
     OPENCLAW_STATE_DIR="${STATE_DIR}" \\
     OPENCLAW_CONFIG_PATH="${CONFIG_PATH}" \\
     openclaw gateway --port 18789
EOF
