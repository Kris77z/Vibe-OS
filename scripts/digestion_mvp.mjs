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

function extractEntryDate(line) {
  const matched = String(line).match(/^\[(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?/);
  return matched ? matched[1] : null;
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
    date: extractEntryDate(entryLines[0]),
    lineCount: entryLines.length,
  }));
}

function buildDailyMemoryTargets(entries) {
  const seen = new Set();
  const targets = [];

  for (const entry of entries) {
    if (!entry?.date || seen.has(entry.date)) continue;
    seen.add(entry.date);
    targets.push({
      date: entry.date,
      path: `memory/${entry.date}.md`,
    });
  }

  return targets;
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
  const dailyMemoryTargets = buildDailyMemoryTargets(newEntries);

  if (newEntries.length === 0) {
    return {
      status: "noop",
      summary: "没有新的 braindump 条目需要消化，也不要改写 daily memory。",
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
    objective: "整理新增 braindump，并按 memory 写入规范更新 daily memory、mission_log 与 knowledge",
    context: {
      source,
      workspaceRoot,
      files: [
        "memory/braindump.md",
        "memory/mission_log.md",
        "memory/digestion_state.json",
        ...dailyMemoryTargets.map((target) => target.path),
      ],
      startLine,
      endLine,
      excerpt,
      dailyMemoryTargets,
      entries: newEntries.map((entry) => ({
        startLine: entry.startLine,
        endLine: entry.endLine,
        date: entry.date,
        lineCount: entry.lineCount,
      })),
    },
    constraints: {
      writeScope: [
        "memory/mission_log.md",
        ...dailyMemoryTargets.map((target) => target.path),
        "memory/knowledge/",
        "memory/digestion_state.json",
      ],
      maxDurationSec: 300,
      toolProfile: "standard-project",
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
    return "当前没有新的 braindump 条目需要消化，不要改写 daily memory、mission_log 或 knowledge。";
  }

  const startLine = payload?.context?.startLine;
  const endLine = payload?.context?.endLine;
  const excerpt = String(payload?.context?.excerpt || "").trim();
  const dailyMemoryTargets = Array.isArray(payload?.context?.dailyMemoryTargets)
    ? payload.context.dailyMemoryTargets
    : [];
  const dailyMemoryTargetList =
    dailyMemoryTargets.length > 0
      ? dailyMemoryTargets.map((item) => `- ${item.path}`).join("\n")
      : "- memory/<YYYY-MM-DD>.md";

  return [
    "你现在执行一次 Vibe-OS digestion 任务。",
    "只处理本次提供的新增 braindump 片段，不要重复整理历史内容。",
    "每条片段以时间戳行开头，后续连续文本都属于同一条记录。",
    `本次处理范围：memory/braindump.md 第 ${startLine} 行到第 ${endLine} 行。`,
    "",
    "请严格执行以下约束：",
    "1. 不要改写或删除 memory/braindump.md。",
    "2. 如果发现明确的 TODO、跟进项、下一步行动，追加写入 memory/mission_log.md。",
    "3. 默认把近期上下文、推进脉络、短期结论、风险观察写入对应日期的 daily memory 文件。",
    "4. daily memory 目标文件如下；如果文件不存在，可以新建：",
    dailyMemoryTargetList,
    "5. daily memory 不要直接复制原始 braindump，要蒸馏后再写；优先用这些分节：Active Context、Decisions、Risks / Watchpoints、Promotion Candidates。",
    "6. 如果发现值得长期复用的专题知识或原则，优先追加到已有的 memory/knowledge/*.md；只有确认没有合适主题文件时才新建。",
    "7. knowledge 文件命名保持 snake_case，不要为同一主题同时创建连字符和下划线两种文件名。",
    "8. 这一轮不要默认改写 MEMORY.md；除非明确是高置信、跨天稳定的 durable memory，否则保持不动。",
    "9. 如果内容只是噪音、测试或纯情绪且没有长期价值，可以不写入 daily memory、mission_log 或 knowledge。",
    "10. 完成后只输出一个严格符合 task_result_v1 的 JSON，不要输出额外解释文字。",
    "11. task_result_v1 里：artifacts 必须是数组，actions 必须是数组，memoryWrites 必须是数组；不要自造对象形状。",
    "12. artifact.type 只能用 file_update / file_create / file_delete / report / command_result；action.type 只能用 append / update / create / delete / notify / noop；memoryWrites[].reason 只能用 long_term_knowledge / task_update / session_summary / other。",
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
