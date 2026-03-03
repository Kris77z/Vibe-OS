#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();
const memoryDir = path.join(workspaceRoot, "memory");
const braindumpPath = path.join(memoryDir, "braindump.md");
const missionLogPath = path.join(memoryDir, "mission_log.md");
const knowledgeDir = path.join(memoryDir, "knowledge");
const statePath = path.join(memoryDir, "digestion_state.json");

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

function ensureStateFile() {
  if (fs.existsSync(statePath)) return;

  fs.writeFileSync(
    statePath,
    JSON.stringify(
      {
        lastProcessedLine: 0,
        lastProcessedAt: null,
      },
      null,
      2,
    ) + "\n",
  );
}

function readState() {
  ensureStateFile();

  const raw = fs.readFileSync(statePath, "utf8");
  const parsed = JSON.parse(raw);

  return {
    lastProcessedLine: Number(parsed.lastProcessedLine || 0),
    lastProcessedAt:
      typeof parsed.lastProcessedAt === "string" ? parsed.lastProcessedAt : null,
  };
}

function writeState(nextState) {
  fs.writeFileSync(statePath, JSON.stringify(nextState, null, 2) + "\n");
}

function readLines(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function isBraindumpEntry(line) {
  return /^\[\d{4}-\d{2}-\d{2}/.test(line);
}

function buildBraindumpEntries(lines) {
  const entries = [];
  let currentEntry = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    if (isBraindumpEntry(line)) {
      if (currentEntry) {
        currentEntry.endLine = lineNumber - 1;
        currentEntry.text = currentEntry.lines.join("\n");
        entries.push(currentEntry);
      }

      currentEntry = {
        startLine: lineNumber,
        endLine: lineNumber,
        lines: [line],
        text: line,
      };
      continue;
    }

    if (!currentEntry) continue;
    currentEntry.lines.push(line);
  }

  if (currentEntry) {
    currentEntry.endLine = lines.length;
    currentEntry.text = currentEntry.lines.join("\n");
    entries.push(currentEntry);
  }

  return entries.map(({ lines: entryLines, ...entry }) => ({
    ...entry,
    lineCount: entryLines.length,
  }));
}

function buildPreparePayload(source = "manual") {
  if (!fs.existsSync(braindumpPath)) {
    fail(`Missing braindump file: ${braindumpPath}`);
  }

  if (!fs.existsSync(missionLogPath)) {
    fail(`Missing mission log file: ${missionLogPath}`);
  }

  if (!fs.existsSync(knowledgeDir)) {
    fail(`Missing knowledge directory: ${knowledgeDir}`);
  }

  const state = readState();
  const lines = readLines(braindumpPath);
  const indexedEntries = buildBraindumpEntries(lines);
  const newEntries = indexedEntries.filter(
    (item) => item.endLine > state.lastProcessedLine,
  );

  if (newEntries.length === 0) {
    return {
      status: "noop",
      summary: "没有新的 braindump 条目需要消化。",
      state,
      stats: {
        totalLines: lines.length,
        totalEntries: indexedEntries.length,
        newEntries: 0,
      },
    };
  }

  const startLine = newEntries[0].startLine;
  const endLine = newEntries[newEntries.length - 1].endLine;
  const excerpt = lines.slice(startLine - 1, endLine).join("\n");
  const requestId = `digestion_${new Date().toISOString()}`;

  return {
    requestId,
    instanceId: "vibe-os",
    kind: "task_run",
    objective: "整理新增 braindump 并更新 mission_log 与 knowledge",
    context: {
      source,
      workspaceRoot,
      files: [
        "memory/braindump.md",
        "memory/mission_log.md",
        "memory/digestion_state.json",
      ],
      startLine,
      endLine,
      excerpt,
      entries: newEntries.map((entry) => ({
        startLine: entry.startLine,
        endLine: entry.endLine,
        lineCount: entry.lineCount,
      })),
    },
    constraints: {
      writeScope: [
        "memory/mission_log.md",
        "memory/knowledge/",
        "memory/digestion_state.json",
      ],
      maxDurationSec: 300,
    },
    expectedOutput: {
      format: "json",
      schema: "task_result_v1",
    },
    state,
    stats: {
      totalLines: lines.length,
      totalEntries: indexedEntries.length,
      newEntries: newEntries.length,
    },
  };
}

function commitProgress(endLine) {
  const numericEndLine = Number(endLine);
  if (!Number.isInteger(numericEndLine) || numericEndLine < 0) {
    fail("commit requires a non-negative integer --end-line value.");
  }

  const lines = readLines(braindumpPath);
  if (numericEndLine > lines.length) {
    fail(
      `commit end line ${numericEndLine} exceeds braindump line count ${lines.length}.`,
    );
  }

  const nextState = {
    lastProcessedLine: numericEndLine,
    lastProcessedAt: new Date().toISOString(),
  };
  writeState(nextState);

  return {
    status: "ok",
    summary: "digestion_state 已更新。",
    state: nextState,
  };
}

function renderPrompt(payloadFilePath) {
  if (!payloadFilePath) {
    fail("render-prompt requires --payload-file <path>.");
  }

  const absolutePath = path.isAbsolute(payloadFilePath)
    ? payloadFilePath
    : path.join(workspaceRoot, payloadFilePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Payload file not found: ${absolutePath}`);
  }

  const payload = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  if (payload.status === "noop") {
    return "当前没有新的 braindump 条目需要消化，不要改写 mission_log 或 knowledge。";
  }

  const startLine = payload?.context?.startLine;
  const endLine = payload?.context?.endLine;
  const excerpt = String(payload?.context?.excerpt || "").trim();

  return [
    "你现在执行一次 Vibe-OS digestion 任务。",
    "只处理本次提供的新增 braindump 片段，不要重复整理历史内容。",
    "每条片段以时间戳行开头，后续连续文本都属于同一条记录。",
    `本次处理范围：memory/braindump.md 第 ${startLine} 行到第 ${endLine} 行。`,
    "",
    "请严格执行以下约束：",
    "1. 不要改写或删除 memory/braindump.md。",
    "2. 如果发现明确的 TODO、跟进项、下一步行动，追加写入 memory/mission_log.md。",
    "3. 如果发现值得长期保留的知识或原则，按领域追加到 memory/knowledge/ 对应文件；如无合适文件可新建。",
    "4. 如果内容只是噪音、测试或纯情绪且没有长期价值，可以不写入 mission_log 或 knowledge。",
    "5. 完成后只输出一个简短 JSON，对应 task_result_v1 风格，至少包含 status、summary、artifacts、actions、memoryWrites、errors。",
    "",
    "本次新增 braindump 原文如下：",
    excerpt,
  ].join("\n");
}

function printUsage() {
  console.log(`Usage:
  node scripts/digestion_mvp.mjs prepare [--source manual|cron]
  node scripts/digestion_mvp.mjs commit --end-line <number>
  node scripts/digestion_mvp.mjs render-prompt --payload-file <path>`);
}

const { command, options } = parseArgs(process.argv.slice(2));

switch (command) {
  case "prepare":
    console.log(JSON.stringify(buildPreparePayload(String(options.source || "manual")), null, 2));
    break;
  case "commit":
    console.log(JSON.stringify(commitProgress(options["end-line"]), null, 2));
    break;
  case "render-prompt":
    console.log(renderPrompt(String(options["payload-file"] || "")));
    break;
  default:
    printUsage();
    process.exit(command ? 1 : 0);
}
