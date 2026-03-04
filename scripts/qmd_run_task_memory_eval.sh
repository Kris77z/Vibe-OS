#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/qmd_run_task_memory_eval.sh [--instance-root PATH] [--mission-log PATH]
                                      [--task-memory-output PATH] [--label NAME]
                                      [--base-report PATH] [--compare-output PATH]
                                      [--force-reindex]

Purpose:
  Generate memory/task_memory.md from mission_log and run qmd eval in one command.
Defaults:
  --mission-log defaults to <instance-root>/workspace/memory/mission_log.md
  --task-memory-output defaults to <instance-root>/workspace/memory/task_memory.md
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

INSTANCE_ROOT="${HOME}/instances/vibe-os"
MISSION_LOG_PATH=""
TASK_MEMORY_OUTPUT=""
LABEL="task-memory-candidate"
BASE_REPORT=".logs/qmd-eval/search-baseline-no-mission-log.json"
COMPARE_OUTPUT=".logs/qmd-eval/search-vs-task-memory.md"
FORCE_REINDEX=0

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

note() {
  printf '[INFO] %s\n' "$1"
}

resolve_path() {
  local raw="$1"
  if [[ "$raw" == /* ]]; then
    printf '%s\n' "$raw"
  else
    printf '%s\n' "$REPO_ROOT/$raw"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --instance-root)
      INSTANCE_ROOT="$2"
      shift 2
      ;;
    --mission-log)
      MISSION_LOG_PATH="$2"
      shift 2
      ;;
    --task-memory-output)
      TASK_MEMORY_OUTPUT="$2"
      shift 2
      ;;
    --label)
      LABEL="$2"
      shift 2
      ;;
    --base-report)
      BASE_REPORT="$2"
      shift 2
      ;;
    --compare-output)
      COMPARE_OUTPUT="$2"
      shift 2
      ;;
    --force-reindex)
      FORCE_REINDEX=1
      shift 1
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

NODE_BIN="$(command -v node 2>/dev/null || true)"
if [[ -z "$NODE_BIN" && -x /opt/homebrew/bin/node ]]; then
  NODE_BIN="/opt/homebrew/bin/node"
fi
if [[ -z "$NODE_BIN" && -x /usr/local/bin/node ]]; then
  NODE_BIN="/usr/local/bin/node"
fi
[[ -n "$NODE_BIN" ]] || fail "node not found"

if [[ -z "$MISSION_LOG_PATH" ]]; then
  MISSION_LOG_PATH="$INSTANCE_ROOT/workspace/memory/mission_log.md"
fi
if [[ -z "$TASK_MEMORY_OUTPUT" ]]; then
  TASK_MEMORY_OUTPUT="$INSTANCE_ROOT/workspace/memory/task_memory.md"
fi

MISSION_LOG_ABS="$(resolve_path "$MISSION_LOG_PATH")"
if [[ ! -f "$MISSION_LOG_ABS" ]]; then
  fail "Mission log not found: $MISSION_LOG_ABS"
fi

BASE_REPORT_ABS="$(resolve_path "$BASE_REPORT")"
if [[ ! -f "$BASE_REPORT_ABS" ]]; then
  fail "Base report not found: $BASE_REPORT_ABS (run baseline first)"
fi

note "Generating task memory from mission log"
"$NODE_BIN" "$REPO_ROOT/scripts/distill_mission_log_to_task_memory.mjs" \
  --mission-log "$MISSION_LOG_ABS" \
  --output "$TASK_MEMORY_OUTPUT"

EVAL_ARGS=(
  "--label" "$LABEL"
  "--instance-root" "$INSTANCE_ROOT"
  "--base-report" "$BASE_REPORT"
  "--compare-output" "$COMPARE_OUTPUT"
)
if [[ "$FORCE_REINDEX" -eq 1 ]]; then
  EVAL_ARGS+=("--force-reindex")
fi

note "Running qmd eval with task-memory candidate"
"$REPO_ROOT/scripts/qmd_run_eval.sh" "${EVAL_ARGS[@]}"
