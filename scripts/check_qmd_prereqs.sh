#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/check_qmd_prereqs.sh [--workspace-root PATH] [--state-dir PATH] [--qmd-command PATH]

Purpose:
  Run a deployment-machine preflight for the Vibe-OS QMD rollout.
EOF
}

WORKSPACE_ROOT="${HOME}/instances/vibe-os/workspace"
STATE_DIR="${HOME}/instances/vibe-os/state"
QMD_COMMAND="qmd"

note() { printf '[INFO] %s\n' "$1"; }
pass() { printf '[PASS] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1" >&2; exit 1; }

resolve_cmd() {
  local raw="$1"
  if [[ "$raw" == */* ]]; then
    [[ -x "$raw" ]] || return 1
    printf '%s\n' "$raw"
    return 0
  fi
  command -v "$raw" 2>/dev/null
}

resolve_with_fallbacks() {
  local raw="$1"
  shift

  local resolved=""
  resolved="$(resolve_cmd "$raw" || true)"
  if [[ -n "$resolved" ]]; then
    printf '%s\n' "$resolved"
    return 0
  fi

  local candidate
  for candidate in "$@"; do
    [[ -x "$candidate" ]] || continue
    printf '%s\n' "$candidate"
    return 0
  done

  return 1
}

resolve_preferring_fallbacks() {
  local raw="$1"
  shift

  local candidate
  for candidate in "$@"; do
    [[ -x "$candidate" ]] || continue
    printf '%s\n' "$candidate"
    return 0
  done

  resolve_cmd "$raw"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace-root)
      WORKSPACE_ROOT="$2"
      shift 2
      ;;
    --state-dir)
      STATE_DIR="$2"
      shift 2
      ;;
    --qmd-command)
      QMD_COMMAND="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

WORKSPACE_ROOT="$(cd "$WORKSPACE_ROOT" 2>/dev/null && pwd)" || fail "workspace root not found: $WORKSPACE_ROOT"
mkdir -p "$STATE_DIR"
STATE_DIR="$(cd "$STATE_DIR" 2>/dev/null && pwd)" || fail "state dir not accessible: $STATE_DIR"

note "Workspace root: $WORKSPACE_ROOT"
note "State dir: $STATE_DIR"

OPENCLAW_BIN="$(resolve_cmd openclaw || true)"
[[ -n "$OPENCLAW_BIN" ]] || fail "openclaw not found in PATH"
pass "openclaw: $OPENCLAW_BIN ($("$OPENCLAW_BIN" --version 2>/dev/null || echo 'version unknown'))"

BUN_BIN="$(resolve_with_fallbacks bun "$HOME/.bun/bin/bun" || true)"
[[ -n "$BUN_BIN" ]] || fail "bun not found in PATH"
pass "bun: $BUN_BIN ($("$BUN_BIN" --version 2>/dev/null || echo 'version unknown'))"

if [[ "$QMD_COMMAND" == "qmd" ]]; then
  QMD_BIN="$(resolve_with_fallbacks "$QMD_COMMAND" "$HOME/.bun/bin/qmd" || true)"
else
  QMD_BIN="$(resolve_cmd "$QMD_COMMAND" || true)"
fi
[[ -n "$QMD_BIN" ]] || fail "qmd not found: $QMD_COMMAND"
"$QMD_BIN" --help >/dev/null 2>&1 || fail "qmd executable exists but '--help' failed"
pass "qmd: $QMD_BIN"

SQLITE_BIN="$(resolve_preferring_fallbacks sqlite3 "/opt/homebrew/opt/sqlite/bin/sqlite3" || true)"
[[ -n "$SQLITE_BIN" ]] || fail "sqlite3 not found in PATH"
pass "sqlite3: $SQLITE_BIN ($("$SQLITE_BIN" --version 2>/dev/null || echo 'version unknown'))"

[[ -f "$WORKSPACE_ROOT/MEMORY.md" ]] || fail "missing $WORKSPACE_ROOT/MEMORY.md"
pass "workspace has MEMORY.md"

[[ -d "$WORKSPACE_ROOT/memory" ]] || fail "missing $WORKSPACE_ROOT/memory"
pass "workspace has memory/"

if [[ -d "$WORKSPACE_ROOT/memory/knowledge" ]]; then
  pass "workspace has memory/knowledge/"
else
  warn "memory/knowledge/ is missing; QMD can still start, but first-pass recall surface will be thin"
fi

[[ -w "$STATE_DIR" ]] || fail "state dir is not writable: $STATE_DIR"
pass "state dir is writable"

if "$SQLITE_BIN" ':memory:' 'pragma compile_options;' 2>/dev/null | grep -q 'ENABLE_LOAD_EXTENSION'; then
  pass "sqlite3 reports ENABLE_LOAD_EXTENSION"
else
  warn "sqlite3 does not report ENABLE_LOAD_EXTENSION; treat this as advisory only and trust the real QMD/OpenClaw vector probe during smoke test and memory status"
fi

QMD_STATE_ROOT="$STATE_DIR/agents/main/qmd"
mkdir -p "$QMD_STATE_ROOT/xdg-config" "$QMD_STATE_ROOT/xdg-cache"
pass "agent-scoped QMD state dirs are creatable: $QMD_STATE_ROOT"

printf '\nReady for next step:\n'
printf '  scripts/qmd_smoke_test.sh --workspace-root %q --state-dir %q --agent-id main\n' \
  "$WORKSPACE_ROOT" "$STATE_DIR"
