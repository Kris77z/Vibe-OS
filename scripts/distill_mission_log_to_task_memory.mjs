#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  fail(`Invalid boolean value: ${value}`);
}

function parsePositiveInteger(value, flagName) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`Invalid value for ${flagName}: ${value}`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    missionLog: "memory/mission_log.md",
    output: "memory/task_memory.md",
    includeCompleted: false,
    maxOpen: 50,
    maxCompleted: 20,
    includeEntryAnchors: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[index + 1];

    switch (key) {
      case "mission-log":
        if (!next || next.startsWith("--")) fail("Missing value for --mission-log");
        options.missionLog = next;
        index += 1;
        break;
      case "output":
        if (!next || next.startsWith("--")) fail("Missing value for --output");
        options.output = next;
        index += 1;
        break;
      case "include-completed":
        if (next && !next.startsWith("--")) {
          options.includeCompleted = parseBoolean(next);
          index += 1;
        } else {
          options.includeCompleted = true;
        }
        break;
      case "max-open":
        if (!next || next.startsWith("--")) fail("Missing value for --max-open");
        options.maxOpen = parsePositiveInteger(next, "--max-open");
        index += 1;
        break;
      case "max-completed":
        if (!next || next.startsWith("--")) fail("Missing value for --max-completed");
        options.maxCompleted = parsePositiveInteger(next, "--max-completed");
        index += 1;
        break;
      case "include-entry-anchors":
        if (next && !next.startsWith("--")) {
          options.includeEntryAnchors = parseBoolean(next, true);
          index += 1;
        } else {
          options.includeEntryAnchors = true;
        }
        break;
      case "help":
        printHelp();
        process.exit(0);
        break;
      default:
        fail(`Unknown argument: --${key}`);
    }
  }

  return options;
}

function printHelp() {
  process.stdout.write(`Usage:
  node scripts/distill_mission_log_to_task_memory.mjs [--mission-log PATH] [--output PATH]
       [--include-completed[=true|false]] [--max-open N] [--max-completed N]
       [--include-entry-anchors[=true|false]]

Purpose:
  Distill low-noise task memory from mission_log checklist items into task_memory.md.
`);
}

function asAbsolutePath(rawPath) {
  if (path.isAbsolute(rawPath)) return rawPath;
  return path.join(repoRoot, rawPath);
}

function cleanTaskText(raw) {
  return String(raw || "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.replace(/\[(.*?)\]\((.*?)\)/, "$1"))
    .replace(/[（(]\s*记录于[^）)]*[）)]\s*$/u, "")
    .replace(/\s+/g, " ")
    .replace(/^[-*+]\s*/, "")
    .replace(/[。.!！?？；;,:，：]\s*$/u, "")
    .trim();
}

function normalizeTaskKey(task) {
  return String(task || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function parseMissionItems(content) {
  const openItems = [];
  const completedItems = [];
  const lines = String(content || "").split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    const checkboxMatch = line.match(/^\s*(?:[-*+]|\d+\.)\s+\[([ xX])\]\s+(.+)$/);
    if (checkboxMatch) {
      const done = checkboxMatch[1].toLowerCase() === "x";
      const text = cleanTaskText(checkboxMatch[2]);
      if (!text) continue;

      if (done) {
        completedItems.push({ text, line: lineIndex + 1 });
      } else {
        openItems.push({ text, line: lineIndex + 1 });
      }
      continue;
    }

    const todoMatch = line.match(/^\s*(?:[-*+]|\d+\.)\s*(?:todo|待办)\s*[:：]\s*(.+)$/i);
    if (todoMatch) {
      const text = cleanTaskText(todoMatch[1]);
      if (!text) continue;
      openItems.push({ text, line: lineIndex + 1 });
      continue;
    }

    const plainTodoMatch = line.match(/^\s*(?:todo|待办)\s*[:：]\s*(.+)$/i);
    if (plainTodoMatch) {
      const text = cleanTaskText(plainTodoMatch[1]);
      if (!text) continue;
      openItems.push({ text, line: lineIndex + 1 });
    }
  }

  return { openItems, completedItems };
}

function uniq(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function extractTaskAnchors(taskText) {
  const text = String(taskText || "");
  const lower = text.toLowerCase();
  const anchors = new Set();
  const push = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized || normalized.length < 2) return;
    anchors.add(normalized);
  };

  if (lower.includes("remote") && lower.includes("digestion")) {
    push("remote digestion");
    push("remote-digestion");
  }
  if (lower.includes("remote") && lower.includes("runner")) {
    push("remote runner");
    push("remote-runner");
  }
  if (lower.includes("run_remote_digestion")) {
    push("run_remote_digestion.mjs");
    push("run_remote_digestion");
    push("run remote digestion");
    push("remote digestion");
    push("remote runner");
  }
  if (lower.includes("openclaw")) {
    push("openclaw");
    push("openclaw cron");
  }
  if (lower.includes("cron")) {
    push("cron");
  }
  if (text.includes("验证") && lower.includes("runner")) {
    push("验证 remote runner");
  }
  if (text.includes("远程")) {
    push("远程消化");
    push("远程 runner");
  }
  if (text.includes("消化") || lower.includes("digestion")) {
    push("消化");
    push("digestion");
  }

  const ordered = [
    "验证 remote runner",
    "remote runner",
    "remote-runner",
    "remote digestion",
    "remote-digestion",
    "run_remote_digestion.mjs",
    "run_remote_digestion",
    "run remote digestion",
    "openclaw cron",
    "openclaw",
    "cron",
    "远程消化",
    "远程 runner",
    "digestion",
    "消化",
  ];

  const prioritized = ordered.filter((item) => anchors.has(item));
  if (prioritized.length > 0) {
    return prioritized.slice(0, 8);
  }

  const fallback = lower.match(/[a-z0-9][a-z0-9_.-]{2,}/g) || [];
  return uniq(fallback).slice(0, 8);
}

function buildGlobalAnchors(openItems, completedItems, includeCompleted) {
  const scopedItems = includeCompleted
    ? [...openItems, ...completedItems]
    : [...openItems];
  const all = [];
  for (const item of scopedItems) {
    all.push(...extractTaskAnchors(item.text));
  }
  return uniq(all).slice(0, 120);
}

function dedupeItems(items, limit) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = normalizeTaskKey(item.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
    if (output.length >= limit) break;
  }

  return output;
}

function renderTaskMemory({
  sourcePathLabel,
  openItems,
  completedItems,
  includeCompleted,
  includeEntryAnchors,
}) {
  const globalAnchors = buildGlobalAnchors(
    openItems,
    completedItems,
    includeCompleted,
  );
  const lines = [];
  lines.push("# Task Memory");
  lines.push("");
  lines.push(`> Generated at: ${new Date().toISOString()}`);
  lines.push(`> Source: ${sourcePathLabel}`);
  lines.push("> Purpose: retrieval-focused distilled task context from mission_log.");
  lines.push("");

  lines.push("## Open Tasks");
  lines.push("");
  if (openItems.length === 0) {
    lines.push("- (none)");
  } else {
    for (const item of openItems) {
      lines.push(`- ${item.text}`);
      if (includeEntryAnchors) {
        const anchors = extractTaskAnchors(item.text);
        if (anchors.length > 0) {
          lines.push(`  - query_keys: ${anchors.join(" | ")}`);
        }
      }
    }
  }
  lines.push("");

  if (includeCompleted) {
    lines.push("## Recently Completed");
    lines.push("");
    if (completedItems.length === 0) {
      lines.push("- (none)");
    } else {
      for (const item of completedItems) {
        lines.push(`- ${item.text}`);
        if (includeEntryAnchors) {
          const anchors = extractTaskAnchors(item.text);
          if (anchors.length > 0) {
            lines.push(`  - query_keys: ${anchors.join(" | ")}`);
          }
        }
      }
    }
    lines.push("");
  }

  lines.push("## Search Anchors");
  lines.push("");
  if (globalAnchors.length === 0) {
    lines.push("- (none)");
  } else {
    lines.push(`- ${globalAnchors.join(" | ")}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const missionLogPath = asAbsolutePath(options.missionLog);
  const outputPath = asAbsolutePath(options.output);

  if (!fs.existsSync(missionLogPath)) {
    fail(`Mission log not found: ${missionLogPath}`);
  }

  const missionLogContent = fs.readFileSync(missionLogPath, "utf8");
  const parsed = parseMissionItems(missionLogContent);
  const openItems = dedupeItems(parsed.openItems, options.maxOpen);
  const completedItems = dedupeItems(parsed.completedItems, options.maxCompleted);
  const rendered = renderTaskMemory({
    sourcePathLabel: options.missionLog,
    openItems,
    completedItems,
    includeCompleted: options.includeCompleted,
    includeEntryAnchors: options.includeEntryAnchors,
  });

  const before = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
  const changed = before !== rendered;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (changed) {
    fs.writeFileSync(outputPath, rendered, "utf8");
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        status: "ok",
        changed,
        missionLogPath,
        outputPath,
        openCount: openItems.length,
        completedCount: completedItems.length,
        includeCompleted: options.includeCompleted,
        includeEntryAnchors: options.includeEntryAnchors,
      },
      null,
      2,
    )}\n`,
  );
}

main();
