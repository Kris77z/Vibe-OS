#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/qmd_run_eval.sh --label NAME [--instance-root PATH] [--profile NAME] [--agent-id ID]
                          [--queries-file PATH] [--output PATH] [--eval-dir PATH]
                          [--openclaw-bin PATH] [--node-bin PATH]
                          [--force-reindex]
                          [--base-report PATH] [--compare-output PATH]

Purpose:
  Run qmd_eval_matrix with deployment-safe runtime resolution, and optionally compare
  with an existing baseline report.
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

INSTANCE_ROOT="${HOME}/instances/vibe-os"
PROFILE="vibe-os"
AGENT_ID="main"
LABEL=""
QUERIES_FILE=""
OUTPUT_PATH=""
EVAL_DIR=".logs/qmd-eval"
OPENCLAW_BIN_RAW="${OPENCLAW_BIN:-}"
NODE_BIN_RAW="${NODE_BIN:-}"
FORCE_REINDEX=0
BASE_REPORT=""
COMPARE_OUTPUT=""

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

note() {
  printf '[INFO] %s\n' "$1"
}

resolve_executable() {
  local configured="$1"
  shift

  if [[ -n "$configured" ]]; then
    if [[ "$configured" == */* ]]; then
      [[ -x "$configured" ]] || fail "Executable not found: $configured"
      printf '%s\n' "$configured"
      return 0
    fi

    local found
    found="$(command -v "$configured" 2>/dev/null || true)"
    [[ -n "$found" ]] || fail "Executable not found in PATH: $configured"
    printf '%s\n' "$found"
    return 0
  fi

  local candidate
  for candidate in "$@"; do
    [[ -x "$candidate" ]] || continue
    printf '%s\n' "$candidate"
    return 0
  done

  for candidate in "$@"; do
    if [[ "$candidate" != */* ]]; then
      local found
      found="$(command -v "$candidate" 2>/dev/null || true)"
      if [[ -n "$found" ]]; then
        printf '%s\n' "$found"
        return 0
      fi
    fi
  done

  return 1
}

abspath_from_repo() {
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
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --agent-id)
      AGENT_ID="$2"
      shift 2
      ;;
    --label)
      LABEL="$2"
      shift 2
      ;;
    --queries-file)
      QUERIES_FILE="$2"
      shift 2
      ;;
    --output)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    --eval-dir)
      EVAL_DIR="$2"
      shift 2
      ;;
    --openclaw-bin)
      OPENCLAW_BIN_RAW="$2"
      shift 2
      ;;
    --node-bin)
      NODE_BIN_RAW="$2"
      shift 2
      ;;
    --force-reindex)
      FORCE_REINDEX=1
      shift 1
      ;;
    --base-report)
      BASE_REPORT="$2"
      shift 2
      ;;
    --compare-output)
      COMPARE_OUTPUT="$2"
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

[[ -n "$LABEL" ]] || fail "Missing required argument: --label"

INSTANCE_ROOT="$(cd "$INSTANCE_ROOT" 2>/dev/null && pwd)" || fail "instance root not found: $INSTANCE_ROOT"
STATE_DIR="$INSTANCE_ROOT/state"
CONFIG_PATH="$INSTANCE_ROOT/config/openclaw.json"
[[ -d "$STATE_DIR" ]] || fail "state dir not found: $STATE_DIR"
[[ -f "$CONFIG_PATH" ]] || fail "config file not found: $CONFIG_PATH"

OPENCLAW_BIN="$(
  resolve_executable \
    "$OPENCLAW_BIN_RAW" \
    "/opt/homebrew/bin/openclaw" \
    "/usr/local/bin/openclaw" \
    "openclaw"
)" || fail "Cannot resolve openclaw executable"

NODE_BIN="$(
  resolve_executable \
    "$NODE_BIN_RAW" \
    "/opt/homebrew/bin/node" \
    "/usr/local/bin/node" \
    "node"
)" || fail "Cannot resolve node executable"

if [[ -n "$OUTPUT_PATH" ]]; then
  OUTPUT_ABS="$(abspath_from_repo "$OUTPUT_PATH")"
else
  EVAL_DIR_ABS="$(abspath_from_repo "$EVAL_DIR")"
  OUTPUT_ABS="$EVAL_DIR_ABS/$LABEL.json"
fi
mkdir -p "$(dirname "$OUTPUT_ABS")"

if [[ -n "$BASE_REPORT" ]]; then
  BASE_ABS="$(abspath_from_repo "$BASE_REPORT")"
  [[ -f "$BASE_ABS" ]] || fail "base report not found: $BASE_ABS"
else
  BASE_ABS=""
fi

if [[ -n "$COMPARE_OUTPUT" ]]; then
  COMPARE_OUTPUT_ABS="$(abspath_from_repo "$COMPARE_OUTPUT")"
elif [[ -n "$BASE_ABS" ]]; then
  COMPARE_OUTPUT_ABS="$(dirname "$OUTPUT_ABS")/${LABEL}-vs-$(basename "$BASE_ABS" .json).md"
else
  COMPARE_OUTPUT_ABS=""
fi

note "openclaw: $OPENCLAW_BIN"
note "node: $NODE_BIN"
note "instance root: $INSTANCE_ROOT"
note "state dir: $STATE_DIR"
note "config: $CONFIG_PATH"
note "output: $OUTPUT_ABS"

if [[ "$FORCE_REINDEX" -eq 1 ]]; then
  note "Running force reindex before eval"
  OPENCLAW_PROFILE="$PROFILE" \
  OPENCLAW_STATE_DIR="$STATE_DIR" \
  OPENCLAW_CONFIG_PATH="$CONFIG_PATH" \
    "$OPENCLAW_BIN" memory index --agent "$AGENT_ID" --force
fi

MATRIX_ARGS=(
  "$REPO_ROOT/scripts/qmd_eval_matrix.mjs"
  "--label" "$LABEL"
  "--agent" "$AGENT_ID"
  "--profile" "$PROFILE"
  "--instance-root" "$INSTANCE_ROOT"
  "--openclaw-bin" "$OPENCLAW_BIN"
  "--format" "json"
  "--output" "$OUTPUT_ABS"
)
if [[ -n "$QUERIES_FILE" ]]; then
  MATRIX_ARGS+=("--queries-file" "$QUERIES_FILE")
fi

"$NODE_BIN" "${MATRIX_ARGS[@]}"
note "Eval report written: $OUTPUT_ABS"

if [[ -n "$BASE_ABS" ]]; then
  [[ -n "$COMPARE_OUTPUT_ABS" ]] || fail "compare output resolution failed"
  mkdir -p "$(dirname "$COMPARE_OUTPUT_ABS")"
  "$NODE_BIN" "$REPO_ROOT/scripts/qmd_compare_eval_reports.mjs" \
    --base "$BASE_ABS" \
    --candidate "$OUTPUT_ABS" \
    --output "$COMPARE_OUTPUT_ABS"
  note "Comparison report written: $COMPARE_OUTPUT_ABS"
fi

