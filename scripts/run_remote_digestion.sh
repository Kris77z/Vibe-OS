#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNNER_PATH="${SCRIPT_DIR}/run_remote_digestion.mjs"
CONTROLLER_ROOT="${DIGESTION_CONTROLLER_ROOT:-${HOME}/.vibe-os-controller}"
ENV_FILE="${CONTROLLER_ROOT}/remote_digestion.env"
STATE_DIR="${CONTROLLER_ROOT}/state"
STATE_PATH="${STATE_DIR}/remote_digestion_last_run.json"
SUCCESS_PATH="${STATE_DIR}/remote_digestion_last_success.json"
FAILURE_PATH="${STATE_DIR}/remote_digestion_last_failure.json"
ALERT_PATH="${STATE_DIR}/remote_digestion_last_alert.json"
HISTORY_PATH="${STATE_DIR}/remote_digestion_runs.jsonl"
LOCK_DIR="${STATE_DIR}/remote_digestion.lock"

mkdir -p "${STATE_DIR}"

if [ -f "${ENV_FILE}" ]; then
  set -a
  . "${ENV_FILE}"
  set +a
fi

NODE_BIN=""
for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
  if [ -x "$candidate" ]; then
    NODE_BIN="$candidate"
    break
  fi
done

if [ -z "$NODE_BIN" ]; then
  NODE_BIN="$(command -v node || true)"
fi

if [ -z "$NODE_BIN" ]; then
  echo "node not found for run_remote_digestion.sh" >&2
  exit 1
fi

if ! mkdir "${LOCK_DIR}" >/dev/null 2>&1; then
  python3 - "${STATE_PATH}" "${HISTORY_PATH}" <<'PY'
import json
import sys
from datetime import datetime, timezone

state_path = sys.argv[1]
history_path = sys.argv[2]
now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
payload = {
    "status": "skipped_locked",
    "summary": "remote digestion 已有运行中的任务，本轮跳过。",
    "startedAt": now,
    "endedAt": now,
    "durationMs": 0,
    "exitCode": 0,
}

with open(state_path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2)
    handle.write("\n")

with open(history_path, "a", encoding="utf-8") as handle:
    handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
PY
  echo "remote digestion already running; skipped."
  exit 0
fi

cleanup() {
  rm -rf "${LOCK_DIR}"
  if [ -n "${TMP_STDOUT:-}" ] && [ -f "${TMP_STDOUT}" ]; then
    rm -f "${TMP_STDOUT}"
  fi
  if [ -n "${TMP_STDERR:-}" ] && [ -f "${TMP_STDERR}" ]; then
    rm -f "${TMP_STDERR}"
  fi
}

trap cleanup EXIT

TMP_STDOUT="$(mktemp)"
TMP_STDERR="$(mktemp)"
START_TS="$(python3 - <<'PY'
from datetime import datetime, timezone
print(datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
PY
)"
START_MS="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"

set +e
cd "$SCRIPT_DIR"
if [ "${DIGESTION_FORCE_FAILURE:-0}" = "1" ]; then
  printf '%s\n' "${DIGESTION_FORCE_FAILURE_MESSAGE:-forced remote digestion failure}" >"${TMP_STDERR}"
  EXIT_CODE=1
else
  "$NODE_BIN" "$RUNNER_PATH" run "$@" >"${TMP_STDOUT}" 2>"${TMP_STDERR}"
  EXIT_CODE=$?
fi
set -e

END_TS="$(python3 - <<'PY'
from datetime import datetime, timezone
print(datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
PY
)"
END_MS="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"

python3 - "${STATE_PATH}" "${SUCCESS_PATH}" "${FAILURE_PATH}" "${ALERT_PATH}" "${HISTORY_PATH}" "${TMP_STDOUT}" "${TMP_STDERR}" "${START_TS}" "${END_TS}" "${START_MS}" "${END_MS}" "${EXIT_CODE}" "${DIGESTION_ENABLE_MACOS_NOTIFICATIONS:-1}" "${DIGESTION_ALERT_COOLDOWN_SECONDS:-21600}" <<'PY'
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

state_path = Path(sys.argv[1])
success_path = Path(sys.argv[2])
failure_path = Path(sys.argv[3])
alert_path = Path(sys.argv[4])
history_path = Path(sys.argv[5])
stdout_path = Path(sys.argv[6])
stderr_path = Path(sys.argv[7])
start_ts = sys.argv[8]
end_ts = sys.argv[9]
start_ms = int(sys.argv[10])
end_ms = int(sys.argv[11])
exit_code = int(sys.argv[12])
notifications_enabled = sys.argv[13] == "1"
alert_cooldown_seconds = max(0, int(sys.argv[14]))
webhook_url = os.environ.get("DIGESTION_ALERT_WEBHOOK_URL", "").strip()
webhook_bearer = os.environ.get("DIGESTION_ALERT_WEBHOOK_BEARER", "").strip()
telegram_bot_token = os.environ.get("DIGESTION_ALERT_TELEGRAM_BOT_TOKEN", "").strip()
telegram_chat_id = os.environ.get("DIGESTION_ALERT_TELEGRAM_CHAT_ID", "").strip()

stdout_text = stdout_path.read_text(encoding="utf-8")
stderr_text = stderr_path.read_text(encoding="utf-8")

def extract_summary(text: str, fallback: str):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return fallback

    priority_patterns = (
        "ssh:",
        "curl:",
        "permission denied",
        "timed out",
        "connection refused",
        "no route to host",
        "failed to",
        "missing ",
        "enoent",
        "econn",
    )

    for line in lines:
        normalized = line.lower()
        if any(pattern in normalized for pattern in priority_patterns):
            return line

    for line in lines:
        if line.startswith("at ") or line.startswith("Node.js "):
            continue
        if line in {"Error", "Traceback (most recent call last):"}:
            continue
        return line

    return lines[-1]

result = None
status = "error" if exit_code else "ok"
summary = "remote digestion completed."
try:
    parsed = json.loads(stdout_text)
    if isinstance(parsed, dict):
        result = parsed
        status = str(parsed.get("status") or status)
        summary = str(parsed.get("summary") or summary)
except Exception:
    if exit_code == 0 and stdout_text.strip():
        summary = extract_summary(stdout_text, summary)
    elif exit_code != 0 and stderr_text.strip():
        summary = extract_summary(stderr_text, summary)

payload = {
    "status": status,
    "summary": summary,
    "startedAt": start_ts,
    "endedAt": end_ts,
    "durationMs": max(0, end_ms - start_ms),
    "exitCode": exit_code,
}

if isinstance(result, dict):
    payload["result"] = result

if stdout_text.strip():
    payload["stdoutTail"] = "\n".join(stdout_text.strip().splitlines()[-20:])

if stderr_text.strip():
    payload["stderrTail"] = "\n".join(stderr_text.strip().splitlines()[-20:])

state_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
with history_path.open("a", encoding="utf-8") as handle:
    handle.write(json.dumps(payload, ensure_ascii=False) + "\n")

if exit_code == 0:
    success_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
else:
    failure_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def read_json_if_exists(file_path: Path):
    if not file_path.exists():
        return None
    return json.loads(file_path.read_text(encoding="utf-8"))

def parse_timestamp(value: str):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))

def notify_macos(title: str, message: str):
    osascript_path = shutil.which("osascript")
    if not osascript_path:
        return {"attempted": False, "notified": False, "error": "osascript not found"}

    applescript = """
on run argv
  set notificationTitle to item 1 of argv
  set notificationBody to item 2 of argv
  display notification notificationBody with title notificationTitle
end run
""".strip()

    try:
        subprocess.run(
            [osascript_path, "-", title, message],
            input=applescript,
            text=True,
            check=True,
            capture_output=True,
        )
        return {"attempted": True, "notified": True, "error": None}
    except Exception as error:
        return {"attempted": True, "notified": False, "error": str(error)}

def post_json(url: str, body: dict, headers=None):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    for key, value in (headers or {}).items():
        if value:
            req.add_header(key, value)

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            text = response.read().decode("utf-8", errors="replace")
            return {
                "attempted": True,
                "notified": True,
                "statusCode": getattr(response, "status", None),
                "error": None,
                "responseBodyTail": text[-500:] if text else "",
            }
    except urllib.error.HTTPError as error:
        text = error.read().decode("utf-8", errors="replace")
        return {
            "attempted": True,
            "notified": False,
            "statusCode": error.code,
            "error": str(error),
            "responseBodyTail": text[-500:] if text else "",
        }
    except Exception as error:
        return {
            "attempted": True,
            "notified": False,
            "statusCode": None,
            "error": str(error),
            "responseBodyTail": "",
        }

def notify_webhook(body: dict):
    if not webhook_url:
        return {"configured": False, "attempted": False, "notified": False, "error": None}
    headers = {}
    if webhook_bearer:
        headers["Authorization"] = f"Bearer {webhook_bearer}"
    result = post_json(webhook_url, body, headers)
    result["configured"] = True
    return result

def notify_telegram(text: str):
    if not telegram_bot_token or not telegram_chat_id:
        return {"configured": False, "attempted": False, "notified": False, "error": None}

    result = post_json(
        f"https://api.telegram.org/bot{telegram_bot_token}/sendMessage",
        {"chat_id": telegram_chat_id, "text": text},
    )
    result["configured"] = True
    return result

if exit_code != 0:
    fingerprint = json.dumps(
        {
            "status": status,
            "summary": summary,
            "stderrTail": payload.get("stderrTail"),
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    previous_alert = read_json_if_exists(alert_path) or {}
    now = parse_timestamp(end_ts)
    previous_at = previous_alert.get("alertedAt")
    previous_fingerprint = previous_alert.get("fingerprint")
    cooldown_active = False
    if previous_at and previous_fingerprint == fingerprint:
        elapsed_seconds = (now - parse_timestamp(previous_at)).total_seconds()
        cooldown_active = elapsed_seconds < alert_cooldown_seconds

    alert_payload = {
        "status": status,
        "summary": summary,
        "fingerprint": fingerprint,
        "alertedAt": end_ts,
        "cooldownSeconds": alert_cooldown_seconds,
        "notificationEnabled": notifications_enabled,
        "notified": False,
        "notificationAttempted": False,
        "notificationError": None,
        "suppressedByCooldown": cooldown_active,
        "deliveries": {
            "macos": {"configured": notifications_enabled, "attempted": False, "notified": False, "error": None},
            "webhook": {"configured": bool(webhook_url), "attempted": False, "notified": False, "error": None},
            "telegram": {"configured": bool(telegram_bot_token and telegram_chat_id), "attempted": False, "notified": False, "error": None},
        },
        "run": payload,
    }

    if notifications_enabled and not cooldown_active:
        message = summary.strip() or "remote digestion failed"
        if payload.get("stderrTail"):
            message = f"{message}\n{payload['stderrTail'].splitlines()[-1][:120]}"
        message = message[:180]
        notify_result = notify_macos("Vibe-OS Digestion Failed", message)
        alert_payload["notificationAttempted"] = notify_result["attempted"]
        alert_payload["notified"] = notify_result["notified"]
        alert_payload["notificationError"] = notify_result["error"]
        alert_payload["deliveries"]["macos"] = {
            "configured": True,
            "attempted": notify_result["attempted"],
            "notified": notify_result["notified"],
            "error": notify_result["error"],
        }

    if not cooldown_active:
        webhook_body = {
            "source": "vibe-os-remote-digestion",
            "event": "digestion_failed",
            "status": status,
            "summary": summary,
            "run": payload,
        }
        webhook_result = notify_webhook(webhook_body)
        alert_payload["deliveries"]["webhook"] = webhook_result

        telegram_lines = [
            "Vibe-OS digestion failed",
            summary.strip() or "unknown error",
            f"endedAt: {end_ts}",
        ]
        if payload.get("stderrTail"):
            telegram_lines.append(payload["stderrTail"].splitlines()[-1][:180])
        telegram_result = notify_telegram("\n".join(telegram_lines))
        alert_payload["deliveries"]["telegram"] = telegram_result

    alert_path.write_text(json.dumps(alert_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
elif alert_path.exists():
    previous_alert = read_json_if_exists(alert_path) or {}
    resolved_payload = {
        "status": "resolved",
        "resolvedAt": end_ts,
        "previousAlert": previous_alert,
        "deliveries": previous_alert.get("deliveries"),
        "run": payload,
    }
    alert_path.write_text(json.dumps(resolved_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY

cat "${TMP_STDOUT}"
if [ -s "${TMP_STDERR}" ]; then
  cat "${TMP_STDERR}" >&2
fi

exit "${EXIT_CODE}"
