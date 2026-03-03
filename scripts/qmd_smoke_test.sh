#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/qmd_smoke_test.sh [--workspace-root PATH] [--state-dir PATH] [--agent-id ID] [--qmd-command PATH] [--query TEXT]

Purpose:
  Validate that QMD can bootstrap collections and serve a minimal search for Vibe-OS
  before OpenClaw switches memory.backend from builtin to qmd.
EOF
}

WORKSPACE_ROOT="${HOME}/instances/vibe-os/workspace"
STATE_DIR="${HOME}/instances/vibe-os/state"
AGENT_ID="main"
QMD_COMMAND="qmd"
QUERY_TEXT="Vibe-OS"

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

contains_text() {
  local needle="$1"
  local haystack="$2"
  printf '%s\n' "$haystack" | grep -Fq "$needle"
}

collection_exists() {
  local name="$1"
  local listed="$2"
  contains_text "\"$name\"" "$listed" || contains_text "$name" "$listed"
}

ensure_collection() {
  local path_arg="$1"
  local name="$2"
  local mask="$3"
  local listed="$4"

  if collection_exists "$name" "$listed"; then
    pass "collection already exists: $name"
    return 0
  fi

  local output
  if output="$("$QMD_BIN" collection add "$path_arg" --name "$name" --mask "$mask" 2>&1)"; then
    pass "collection added: $name"
    return 0
  fi

  if contains_text "already exists" "$output"; then
    pass "collection already exists: $name"
    return 0
  fi

  printf '%s\n' "$output" >&2
  fail "failed to add collection: $name"
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
    --agent-id)
      AGENT_ID="$2"
      shift 2
      ;;
    --qmd-command)
      QMD_COMMAND="$2"
      shift 2
      ;;
    --query)
      QUERY_TEXT="$2"
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
if [[ "$QMD_COMMAND" == "qmd" ]]; then
  QMD_BIN="$(resolve_with_fallbacks "$QMD_COMMAND" "$HOME/.bun/bin/qmd" || true)"
else
  QMD_BIN="$(resolve_cmd "$QMD_COMMAND" || true)"
fi
[[ -n "$QMD_BIN" ]] || fail "qmd not found: $QMD_COMMAND"

[[ -f "$WORKSPACE_ROOT/MEMORY.md" ]] || fail "missing $WORKSPACE_ROOT/MEMORY.md"

QMD_ROOT="$STATE_DIR/agents/$AGENT_ID/qmd"
export XDG_CONFIG_HOME="$QMD_ROOT/xdg-config"
export XDG_CACHE_HOME="$QMD_ROOT/xdg-cache"
mkdir -p "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"

MEMORY_COLLECTION="memory-root-$AGENT_ID"
KNOWLEDGE_COLLECTION="knowledge-$AGENT_ID"
INDEX_PATH="$XDG_CACHE_HOME/qmd/index.sqlite"

note "Workspace root: $WORKSPACE_ROOT"
note "State dir: $STATE_DIR"
note "Agent id: $AGENT_ID"
note "QMD XDG config: $XDG_CONFIG_HOME"
note "QMD XDG cache: $XDG_CACHE_HOME"

LISTED="$("$QMD_BIN" collection list --json 2>/dev/null || true)"
ensure_collection "$WORKSPACE_ROOT" "$MEMORY_COLLECTION" "MEMORY.md" "$LISTED"

if [[ -d "$WORKSPACE_ROOT/memory/knowledge" ]]; then
  ensure_collection "$WORKSPACE_ROOT/memory/knowledge" "$KNOWLEDGE_COLLECTION" "**/*.md" "$LISTED"
else
  warn "memory/knowledge/ missing; skip knowledge collection"
fi

"$QMD_BIN" update
pass "qmd update completed"

SEARCH_OUTPUT="$("$QMD_BIN" search "$QUERY_TEXT" -c "$MEMORY_COLLECTION" --json 2>&1)" || {
  printf '%s\n' "$SEARCH_OUTPUT" >&2
  fail "qmd search failed"
}
pass "qmd search completed"

[[ -f "$INDEX_PATH" ]] || fail "qmd index file not found: $INDEX_PATH"
[[ -s "$INDEX_PATH" ]] || fail "qmd index file is empty: $INDEX_PATH"
pass "qmd index file exists: $INDEX_PATH"

printf '\nCollections in play:\n'
printf '  %s\n' "$MEMORY_COLLECTION"
if [[ -d "$WORKSPACE_ROOT/memory/knowledge" ]]; then
  printf '  %s\n' "$KNOWLEDGE_COLLECTION"
fi

printf '\nSearch output sample:\n%s\n' "$SEARCH_OUTPUT"
