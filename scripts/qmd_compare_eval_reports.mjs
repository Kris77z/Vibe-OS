#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];

    switch (key) {
      case "base":
      case "candidate":
      case "output":
      case "format":
        if (!next || next.startsWith("--")) {
          fail(`Missing value for --${key}`);
        }
        options[key] = next;
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

  if (!options.base || !options.candidate) {
    printHelp();
    process.exit(1);
  }

  options.format = options.format === "json" ? "json" : "markdown";
  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/qmd_compare_eval_reports.mjs --base PATH --candidate PATH [--output PATH] [--format markdown|json]

Purpose:
  Compare two qmd_eval_matrix JSON reports and surface which queries improved, regressed, or changed.
`);
}

function readJson(filePath) {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    fail(`File not found: ${absolute}`);
  }
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}

function normalizeOutput(text) {
  return String(text || "").trim();
}

function isEffectivelyEmpty(result) {
  if (!result?.ok) return true;
  const output = normalizeOutput(result.output);
  if (!output) return true;

  const lowered = output.toLowerCase();
  return (
    lowered.includes("no results found") ||
    lowered.includes("0 results") ||
    lowered === "[]" ||
    lowered === "{}"
  );
}

function compareReports(base, candidate) {
  const baseByQuery = new Map((base.results || []).map((item) => [item.query, item]));
  const candidateByQuery = new Map((candidate.results || []).map((item) => [item.query, item]));
  const queries = Array.from(new Set([...baseByQuery.keys(), ...candidateByQuery.keys()]));

  const rows = queries.map((query) => {
    const left = baseByQuery.get(query) || { ok: false, output: "" };
    const right = candidateByQuery.get(query) || { ok: false, output: "" };
    const leftEmpty = isEffectivelyEmpty(left);
    const rightEmpty = isEffectivelyEmpty(right);
    const sameOutput = normalizeOutput(left.output) === normalizeOutput(right.output);

    let outcome = "changed";
    if (leftEmpty && !rightEmpty) {
      outcome = "improved";
    } else if (!leftEmpty && rightEmpty) {
      outcome = "regressed";
    } else if (sameOutput) {
      outcome = "same";
    }

    return {
      query,
      outcome,
      baseEmpty: leftEmpty,
      candidateEmpty: rightEmpty,
      baseOk: Boolean(left.ok),
      candidateOk: Boolean(right.ok),
      baseOutput: normalizeOutput(left.output),
      candidateOutput: normalizeOutput(right.output),
    };
  });

  return {
    comparedAt: new Date().toISOString(),
    baseLabel: base.label || "base",
    candidateLabel: candidate.label || "candidate",
    totals: {
      improved: rows.filter((row) => row.outcome === "improved").length,
      regressed: rows.filter((row) => row.outcome === "regressed").length,
      changed: rows.filter((row) => row.outcome === "changed").length,
      same: rows.filter((row) => row.outcome === "same").length,
    },
    rows,
  };
}

function renderMarkdown(summary) {
  const lines = [];
  lines.push(`# QMD Eval Comparison`);
  lines.push("");
  lines.push(`- Compared at: ${summary.comparedAt}`);
  lines.push(`- Base: ${summary.baseLabel}`);
  lines.push(`- Candidate: ${summary.candidateLabel}`);
  lines.push(`- Improved: ${summary.totals.improved}`);
  lines.push(`- Regressed: ${summary.totals.regressed}`);
  lines.push(`- Changed: ${summary.totals.changed}`);
  lines.push(`- Same: ${summary.totals.same}`);
  lines.push("");
  lines.push("| Query | Outcome |");
  lines.push("| --- | --- |");
  for (const row of summary.rows) {
    lines.push(`| ${row.query} | ${row.outcome} |`);
  }
  lines.push("");

  for (const row of summary.rows.filter((item) => item.outcome !== "same")) {
    lines.push(`## ${row.query}`);
    lines.push("");
    lines.push(`- Outcome: ${row.outcome}`);
    lines.push("");
    lines.push(`### ${summary.baseLabel}`);
    lines.push("");
    lines.push("```text");
    lines.push(row.baseOutput || "(empty)");
    lines.push("```");
    lines.push("");
    lines.push(`### ${summary.candidateLabel}`);
    lines.push("");
    lines.push("```text");
    lines.push(row.candidateOutput || "(empty)");
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

function writeOutput(content, outputPath) {
  if (!outputPath) {
    process.stdout.write(content);
    return;
  }

  const absolute = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
  console.log(`Wrote ${absolute}`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const base = readJson(options.base);
  const candidate = readJson(options.candidate);
  const summary = compareReports(base, candidate);
  const content =
    options.format === "json"
      ? `${JSON.stringify(summary, null, 2)}\n`
      : `${renderMarkdown(summary)}\n`;
  writeOutput(content, options.output);
}

main();
