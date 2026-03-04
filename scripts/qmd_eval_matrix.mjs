#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const defaultQueriesFile = path.join(repoRoot, "docs", "qmd_eval_queries.txt");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    agent: "main",
    format: "markdown",
    label: "baseline",
    queriesFile: defaultQueriesFile,
    profile: "",
    stateDir: "",
    configPath: "",
    instanceRoot: "",
    openclawBin: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    const expectValue = !["help"].includes(key);
    if (expectValue && (!next || next.startsWith("--"))) {
      fail(`Missing value for --${key}`);
    }

    switch (key) {
      case "agent":
        options.agent = next;
        index += 1;
        break;
      case "label":
        options.label = next;
        index += 1;
        break;
      case "queries-file":
        options.queriesFile = next;
        index += 1;
        break;
      case "profile":
        options.profile = next;
        index += 1;
        break;
      case "state-dir":
        options.stateDir = next;
        index += 1;
        break;
      case "config-path":
        options.configPath = next;
        index += 1;
        break;
      case "instance-root":
        options.instanceRoot = next;
        index += 1;
        break;
      case "openclaw-bin":
        options.openclawBin = next;
        index += 1;
        break;
      case "output":
        options.output = next;
        index += 1;
        break;
      case "format":
        options.format = next;
        index += 1;
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
  console.log(`Usage:
  node scripts/qmd_eval_matrix.mjs [--label NAME] [--agent main] [--queries-file PATH] [--output PATH] [--format markdown|json]
                                [--profile vibe-os] [--state-dir PATH] [--config-path PATH]
                                [--instance-root /Users/.../instances/vibe-os]
                                [--openclaw-bin /opt/homebrew/bin/openclaw]

Purpose:
  Run a fixed QMD memory-search query set against the current OpenClaw config and save a comparable report.
`);
}

function readQueries(filePath) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
  if (!fs.existsSync(absolute)) {
    fail(`Queries file not found: ${absolute}`);
  }

  return fs
    .readFileSync(absolute, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function resolveRuntimeEnv(options) {
  const env = { ...process.env };

  if (options.instanceRoot) {
    const instanceRoot = path.resolve(options.instanceRoot);
    if (!options.stateDir) {
      options.stateDir = path.join(instanceRoot, "state");
    }
    if (!options.configPath) {
      options.configPath = path.join(instanceRoot, "config", "openclaw.json");
    }
  }

  if (options.profile) {
    env.OPENCLAW_PROFILE = options.profile;
  }
  if (options.stateDir) {
    env.OPENCLAW_STATE_DIR = path.resolve(options.stateDir);
  }
  if (options.configPath) {
    env.OPENCLAW_CONFIG_PATH = path.resolve(options.configPath);
  }

  return env;
}

function resolveOpenClawBin(options, env) {
  const configured = String(options.openclawBin || env.OPENCLAW_BIN || "").trim();
  if (configured) {
    return configured;
  }

  const fallbackCandidates = ["/opt/homebrew/bin/openclaw", "/usr/local/bin/openclaw"];
  const fallback = fallbackCandidates.find((candidate) => fs.existsSync(candidate));
  return fallback || "openclaw";
}

function runOpenClaw(openclawBin, args, env) {
  try {
    return {
      ok: true,
      output: execFileSync(openclawBin, args, {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env,
      }).trim(),
    };
  } catch (error) {
    return {
      ok: false,
      output: String(error?.stderr || error?.message || error).trim(),
    };
  }
}

function runStatus(agent, env, openclawBin) {
  return runOpenClaw(openclawBin, ["memory", "status", "--agent", agent, "--deep"], env);
}

function runQuery(agent, query, env, openclawBin) {
  return runOpenClaw(openclawBin, ["memory", "search", "--agent", agent, "--query", query], env);
}

function buildReport(options, queries) {
  const runtimeEnv = resolveRuntimeEnv(options);
  const openclawBin = resolveOpenClawBin(options, runtimeEnv);
  const status = runStatus(options.agent, runtimeEnv, openclawBin);
  const results = queries.map((query) => ({
    query,
    ...runQuery(options.agent, query, runtimeEnv, openclawBin),
  }));

  return {
    generatedAt: new Date().toISOString(),
    host: os.hostname(),
    cwd: process.cwd(),
    label: options.label,
    agent: options.agent,
    runtime: {
      profile: runtimeEnv.OPENCLAW_PROFILE || null,
      stateDir: runtimeEnv.OPENCLAW_STATE_DIR || null,
      configPath: runtimeEnv.OPENCLAW_CONFIG_PATH || null,
      openclawBin,
    },
    queriesFile: path.resolve(
      path.isAbsolute(options.queriesFile)
        ? options.queriesFile
        : path.join(repoRoot, options.queriesFile),
    ),
    status,
    results,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# QMD Eval Report: ${report.label}`);
  lines.push("");
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push(`- Host: ${report.host}`);
  lines.push(`- Agent: ${report.agent}`);
  lines.push(`- Queries file: ${report.queriesFile}`);
  lines.push(`- Profile: ${report.runtime?.profile || "(default)"}`);
  lines.push(`- State dir: ${report.runtime?.stateDir || "(default)"}`);
  lines.push(`- Config path: ${report.runtime?.configPath || "(default)"}`);
  lines.push("");
  lines.push("## Memory Status");
  lines.push("");
  lines.push("```text");
  lines.push(report.status.output || "(empty)");
  lines.push("```");
  lines.push("");
  lines.push("## Query Results");
  lines.push("");

  for (const result of report.results) {
    lines.push(`### ${result.query}`);
    lines.push("");
    lines.push(`- Status: ${result.ok ? "ok" : "error"}`);
    lines.push("");
    lines.push("```text");
    lines.push(result.output || "(empty)");
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

function writeOutput(report, options) {
  const format = options.format === "json" ? "json" : "markdown";
  const content =
    format === "json" ? `${JSON.stringify(report, null, 2)}\n` : `${renderMarkdown(report)}\n`;

  if (!options.output) {
    process.stdout.write(content);
    return;
  }

  const outputPath = path.isAbsolute(options.output)
    ? options.output
    : path.join(repoRoot, options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content);
  console.log(`Wrote ${outputPath}`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const queries = readQueries(options.queriesFile);
  if (queries.length === 0) {
    fail("No queries found.");
  }
  const report = buildReport(options, queries);
  writeOutput(report, options);
}

main();
