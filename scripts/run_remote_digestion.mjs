#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..");
const localDigestionScript = resolveLocalDigestionScript();

function resolveLocalDigestionScript() {
  const candidates = [
    process.env.DIGESTION_LOCAL_SCRIPT_PATH,
    path.join(workspaceRoot, "scripts", "digestion_mvp.mjs"),
    path.join(scriptDir, "digestion_mvp.mjs"),
  ].filter(Boolean);

  const existingPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (existingPath) return existingPath;

  return candidates[0];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { command, options };
}

function getConfig(options) {
  return {
    sshTarget:
      String(options.target || process.env.DIGESTION_SSH_TARGET || "").trim() ||
      "kris@annkimac.tail7f9f42.ts.net",
    sshKeyPath:
      String(options.key || process.env.DIGESTION_SSH_KEY_PATH || "").trim() ||
      path.join(os.homedir(), ".ssh", "id_ed25519_vibe_os_deploy"),
    remoteInstanceRoot:
      String(
        options["instance-root"] || process.env.DIGESTION_REMOTE_INSTANCE_ROOT || "",
      ).trim() || "/Users/kris/instances/vibe-os",
    sshConnectTimeoutSec: Number(
      options["ssh-connect-timeout"] ||
        process.env.DIGESTION_SSH_CONNECT_TIMEOUT_SEC ||
        8,
    ),
  };
}

function sshBaseArgs(config) {
  return [
    "-o",
    "BatchMode=yes",
    "-o",
    "IdentitiesOnly=yes",
    "-o",
    `ConnectTimeout=${Math.max(1, Math.trunc(config.sshConnectTimeoutSec || 8))}`,
    "-o",
    "ConnectionAttempts=1",
    "-i",
    config.sshKeyPath,
    config.sshTarget,
  ];
}

function runSsh(config, remoteCommand, input) {
  try {
    return execFileSync("ssh", [...sshBaseArgs(config), remoteCommand], {
      cwd: workspaceRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      input,
    });
  } catch (error) {
    const stderr = String(error?.stderr || "").trim();
    const message = stderr || String(error?.message || error);
    throw new Error(message);
  }
}

function ensureRemoteState(config) {
  const remoteStatePath = `${config.remoteInstanceRoot}/workspace/memory/digestion_state.json`;

  const script = [
    `if [ ! -f ${shellQuote(remoteStatePath)} ]; then`,
    `cat > ${shellQuote(remoteStatePath)} <<\"EOF\"`,
    "{",
    '  "lastProcessedLine": 0,',
    '  "lastProcessedAt": null',
    "}",
    "EOF",
    "fi",
  ].join("\n");
  runSsh(config, "bash -lc 'cat >/tmp/vibe-os-ensure-state.sh && bash /tmp/vibe-os-ensure-state.sh'", script);

  return remoteStatePath;
}

function fetchRemoteFile(config, remotePath) {
  return runSsh(
    config,
    `bash -lc 'cat ${shellQuote(remotePath)}'`,
    undefined,
  );
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateEnum(value, allowed) {
  return allowed.includes(value);
}

function validateTaskResultV1(result) {
  const errors = [];
  const rootAllowedKeys = new Set([
    "status",
    "summary",
    "artifacts",
    "actions",
    "memoryWrites",
    "nextActions",
    "errors",
  ]);

  if (!isPlainObject(result)) {
    return {
      valid: false,
      errors: ["Result must be a JSON object."],
    };
  }

  for (const key of Object.keys(result)) {
    if (!rootAllowedKeys.has(key)) {
      errors.push(`Unexpected root field: ${key}`);
    }
  }

  if (!validateEnum(result.status, ["ok", "partial", "error"])) {
    errors.push("status must be one of: ok, partial, error");
  }

  if (typeof result.summary !== "string" || !result.summary.trim()) {
    errors.push("summary must be a non-empty string");
  }

  if (!Array.isArray(result.artifacts)) {
    errors.push("artifacts must be an array");
  } else {
    const artifactAllowedKeys = new Set(["type", "path", "description"]);
    for (const [index, item] of result.artifacts.entries()) {
      if (!isPlainObject(item)) {
        errors.push(`artifacts[${index}] must be an object`);
        continue;
      }
      for (const key of Object.keys(item)) {
        if (!artifactAllowedKeys.has(key)) {
          errors.push(`artifacts[${index}] has unexpected field: ${key}`);
        }
      }
      if (!validateEnum(item.type, ["file_update", "file_create", "file_delete", "report", "command_result"])) {
        errors.push(`artifacts[${index}].type is invalid`);
      }
      if (item.path !== undefined && typeof item.path !== "string") {
        errors.push(`artifacts[${index}].path must be a string`);
      }
      if (item.description !== undefined && typeof item.description !== "string") {
        errors.push(`artifacts[${index}].description must be a string`);
      }
    }
  }

  if (!Array.isArray(result.actions)) {
    errors.push("actions must be an array");
  } else {
    const actionAllowedKeys = new Set(["type", "target", "count", "description"]);
    for (const [index, item] of result.actions.entries()) {
      if (!isPlainObject(item)) {
        errors.push(`actions[${index}] must be an object`);
        continue;
      }
      for (const key of Object.keys(item)) {
        if (!actionAllowedKeys.has(key)) {
          errors.push(`actions[${index}] has unexpected field: ${key}`);
        }
      }
      if (!validateEnum(item.type, ["append", "update", "create", "delete", "notify", "noop"])) {
        errors.push(`actions[${index}].type is invalid`);
      }
      if (item.target !== undefined && typeof item.target !== "string") {
        errors.push(`actions[${index}].target must be a string`);
      }
      if (
        item.count !== undefined &&
        (!Number.isInteger(item.count) || item.count < 0)
      ) {
        errors.push(`actions[${index}].count must be a non-negative integer`);
      }
      if (item.description !== undefined && typeof item.description !== "string") {
        errors.push(`actions[${index}].description must be a string`);
      }
    }
  }

  if (!Array.isArray(result.memoryWrites)) {
    errors.push("memoryWrites must be an array");
  } else {
    const memoryWriteAllowedKeys = new Set(["target", "reason"]);
    for (const [index, item] of result.memoryWrites.entries()) {
      if (!isPlainObject(item)) {
        errors.push(`memoryWrites[${index}] must be an object`);
        continue;
      }
      for (const key of Object.keys(item)) {
        if (!memoryWriteAllowedKeys.has(key)) {
          errors.push(`memoryWrites[${index}] has unexpected field: ${key}`);
        }
      }
      if (typeof item.target !== "string" || !item.target.trim()) {
        errors.push(`memoryWrites[${index}].target must be a non-empty string`);
      }
      if (!validateEnum(item.reason, ["long_term_knowledge", "task_update", "session_summary", "other"])) {
        errors.push(`memoryWrites[${index}].reason is invalid`);
      }
    }
  }

  if (result.nextActions !== undefined) {
    if (!Array.isArray(result.nextActions)) {
      errors.push("nextActions must be an array when present");
    } else {
      for (const [index, item] of result.nextActions.entries()) {
        if (typeof item !== "string" || !item.trim()) {
          errors.push(`nextActions[${index}] must be a non-empty string`);
        }
      }
    }
  }

  if (!Array.isArray(result.errors)) {
    errors.push("errors must be an array");
  } else {
    const errorAllowedKeys = new Set(["code", "message", "retryable"]);
    for (const [index, item] of result.errors.entries()) {
      if (!isPlainObject(item)) {
        errors.push(`errors[${index}] must be an object`);
        continue;
      }
      for (const key of Object.keys(item)) {
        if (!errorAllowedKeys.has(key)) {
          errors.push(`errors[${index}] has unexpected field: ${key}`);
        }
      }
      if (typeof item.code !== "string" || !item.code.trim()) {
        errors.push(`errors[${index}].code must be a non-empty string`);
      }
      if (typeof item.message !== "string" || !item.message.trim()) {
        errors.push(`errors[${index}].message must be a non-empty string`);
      }
      if (item.retryable !== undefined && typeof item.retryable !== "boolean") {
        errors.push(`errors[${index}].retryable must be a boolean`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function extractOutputText(responseEnvelope) {
  const outputs = Array.isArray(responseEnvelope?.output) ? responseEnvelope.output : [];
  const parts = [];

  for (const item of outputs) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (block?.type === "output_text" && typeof block.text === "string") {
        parts.push(block.text);
      }
    }
  }

  return parts.join("").trim();
}

function createTempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-os-digestion-"));
  const memoryDir = path.join(root, "memory");
  const knowledgeDir = path.join(memoryDir, "knowledge");

  fs.mkdirSync(knowledgeDir, { recursive: true });
  return { root, memoryDir, knowledgeDir };
}

function writeTempWorkspaceFiles(tempWorkspace, files) {
  fs.writeFileSync(path.join(tempWorkspace.memoryDir, "braindump.md"), files.braindump);
  fs.writeFileSync(path.join(tempWorkspace.memoryDir, "mission_log.md"), files.missionLog);
  fs.writeFileSync(
    path.join(tempWorkspace.memoryDir, "digestion_state.json"),
    files.state,
  );
  fs.writeFileSync(
    path.join(tempWorkspace.knowledgeDir, "README.md"),
    "# Knowledge Base\n",
  );
}

function runLocalDigestionCommand(cwd, args) {
  return execFileSync(process.execPath, [localDigestionScript, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function buildRemoteRequest(prompt) {
  return JSON.stringify(
    {
      model: "openclaw:main",
      input: prompt,
      stream: false,
    },
    null,
    2,
  );
}

function callRemoteGateway(config, requestJson) {
  const script = [
    "set -a",
    `source ${shellQuote(`${config.remoteInstanceRoot}/state/.env`)}`,
    "set +a",
    "cat > /tmp/vibe-os-digestion-request.json <<\"EOF\"",
    requestJson,
    "EOF",
    "curl -sS http://127.0.0.1:18789/v1/responses \\",
    '  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \\',
    '  -H "Content-Type: application/json" \\',
    "  --data-binary @/tmp/vibe-os-digestion-request.json",
  ].join("\n");

  return runSsh(config, "bash -lc 'cat >/tmp/vibe-os-digestion-run.sh && bash /tmp/vibe-os-digestion-run.sh'", script);
}

function writeRemoteState(config, nextState) {
  const remoteStatePath = `${config.remoteInstanceRoot}/workspace/memory/digestion_state.json`;
  const script = [
    `cat > ${shellQuote(remoteStatePath)} <<\"EOF\"`,
    JSON.stringify(nextState, null, 2),
    "EOF",
  ].join("\n");

  runSsh(config, "bash -lc 'cat >/tmp/vibe-os-write-state.sh && bash /tmp/vibe-os-write-state.sh'", script);
}

function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command && command !== "run") {
    fail("Usage: node scripts/run_remote_digestion.mjs run [--target ...] [--key ...] [--instance-root ...]");
  }

  const config = getConfig(options);
  const remoteBraindumpPath = `${config.remoteInstanceRoot}/workspace/memory/braindump.md`;
  const remoteMissionLogPath = `${config.remoteInstanceRoot}/workspace/memory/mission_log.md`;
  const remoteStatePath = `${config.remoteInstanceRoot}/workspace/memory/digestion_state.json`;

  ensureRemoteState(config);

  const tempWorkspace = createTempWorkspace();
  writeTempWorkspaceFiles(tempWorkspace, {
    braindump: fetchRemoteFile(config, remoteBraindumpPath),
    missionLog: fetchRemoteFile(config, remoteMissionLogPath),
    state: fetchRemoteFile(config, remoteStatePath),
  });

  const prepareRaw = runLocalDigestionCommand(tempWorkspace.root, ["prepare", "--source", "remote"]);
  const prepareResult = JSON.parse(prepareRaw);

  if (prepareResult.status === "noop") {
    console.log(JSON.stringify(prepareResult, null, 2));
    return;
  }

  const payloadPath = path.join(tempWorkspace.root, "digestion_payload.json");
  fs.writeFileSync(payloadPath, JSON.stringify(prepareResult, null, 2) + "\n");

  const prompt = runLocalDigestionCommand(tempWorkspace.root, [
    "render-prompt",
    "--payload-file",
    payloadPath,
  ]);
  const responseRaw = callRemoteGateway(config, buildRemoteRequest(prompt));
  const responseEnvelope = JSON.parse(responseRaw);
  const outputText = extractOutputText(responseEnvelope);

  let digestionResult;
  try {
    digestionResult = JSON.parse(outputText);
  } catch (error) {
    fail(`Failed to parse digestion result JSON: ${String(error)}\nRaw output: ${outputText}`);
  }

  const contractValidation = validateTaskResultV1(digestionResult);

  if (digestionResult.status === "ok") {
    const endLine = prepareResult?.context?.endLine;
    if (!Number.isInteger(endLine)) {
      fail("Missing numeric context.endLine in prepare result.");
    }

    const nextState = {
      lastProcessedLine: endLine,
      lastProcessedAt: new Date().toISOString(),
    };
    writeRemoteState(config, nextState);
    digestionResult.controllerState = nextState;
  }

  digestionResult.contractValidation = contractValidation;
  if (!contractValidation.valid) {
    digestionResult.controllerWarnings = [
      `task_result_v1 validation failed with ${contractValidation.errors.length} issue(s)`,
    ];
  }

  digestionResult.prepare = {
    startLine: prepareResult?.context?.startLine,
    endLine: prepareResult?.context?.endLine,
    newEntries: prepareResult?.stats?.newEntries,
  };
  console.log(JSON.stringify(digestionResult, null, 2));
}

try {
  main();
} catch (error) {
  fail(String(error?.message || error));
}
