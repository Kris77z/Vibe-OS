#!/bin/bash

set -euo pipefail

LABEL="ai.vibe-os.remote-digestion"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"

launchctl bootout "gui/$(id -u)" "${PLIST_PATH}" >/dev/null 2>&1 || true
rm -f "${PLIST_PATH}"

echo "Removed ${LABEL}"
echo "plist: ${PLIST_PATH}"
