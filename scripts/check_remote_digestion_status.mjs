#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const controllerRoot =
  String(process.env.DIGESTION_CONTROLLER_ROOT || "").trim() ||
  path.join(os.homedir(), ".vibe-os-controller");
const stateDir = path.join(controllerRoot, "state");
const envPath = path.join(controllerRoot, "remote_digestion.env");
const statePath = path.join(stateDir, "remote_digestion_last_run.json");
const successPath = path.join(stateDir, "remote_digestion_last_success.json");
const failurePath = path.join(stateDir, "remote_digestion_last_failure.json");
const alertPath = path.join(stateDir, "remote_digestion_last_alert.json");
const historyPath = path.join(stateDir, "remote_digestion_runs.jsonl");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readRecentRuns(limit = 5) {
  if (!fs.existsSync(historyPath)) return [];
  const lines = fs
    .readFileSync(historyPath, "utf8")
    .split("\n")
    .filter(Boolean);

  return lines.slice(-limit).map((line) => JSON.parse(line));
}

const lastRun = readJsonIfExists(statePath);
const lastSuccess = readJsonIfExists(successPath);
const lastFailure = readJsonIfExists(failurePath);
const lastAlert = readJsonIfExists(alertPath);
const recentRuns = readRecentRuns();

const payload = {
  controllerRoot,
  files: {
    env: envPath,
    lastRun: statePath,
    lastSuccess: successPath,
    lastFailure: failurePath,
    lastAlert: alertPath,
    history: historyPath,
  },
  lastRun,
  lastSuccess,
  lastFailure,
  lastAlert,
  recentRuns,
};

console.log(JSON.stringify(payload, null, 2));
