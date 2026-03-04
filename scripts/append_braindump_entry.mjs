#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function normalizeContent(raw) {
  const normalized = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalized) {
    fail("EMPTY_BRAINDUMP_CONTENT");
  }

  return normalized;
}

function decodeContent(options) {
  if (typeof options.content === "string") {
    return normalizeContent(options.content);
  }

  if (typeof options["content-b64"] === "string") {
    try {
      return normalizeContent(
        Buffer.from(options["content-b64"], "base64").toString("utf8"),
      );
    } catch (error) {
      fail(`INVALID_CONTENT_B64: ${String(error)}`);
    }
  }

  fail("Missing --content or --content-b64");
}

function formatTimestamp(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function appendBraindump(filePath, content) {
  const targetPath = path.resolve(filePath);
  const lockDir = `${targetPath}.lockdir`;
  const entry = `[${formatTimestamp()}] ${content}`;

  try {
    fs.mkdirSync(lockDir);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      fail("LOCK_BUSY: braindump is being written by another process", 75);
    }
    fail(`LOCK_FAILED: ${String(error)}`);
  }

  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, "", "utf8");
    }

    const beforeBytes = fs.statSync(targetPath).size;
    if (beforeBytes > 0) {
      const fd = fs.openSync(targetPath, "r");
      try {
        const tail = Buffer.alloc(1);
        fs.readSync(fd, tail, 0, 1, beforeBytes - 1);
        if (tail[0] !== 0x0a) {
          fs.appendFileSync(targetPath, "\n", "utf8");
        }
      } finally {
        fs.closeSync(fd);
      }
    }

    fs.appendFileSync(targetPath, `${entry}\n`, "utf8");
    const afterBytes = fs.statSync(targetPath).size;

    if (afterBytes <= beforeBytes) {
      fail("APPEND_FAILED: braindump size did not increase", 70);
    }

    process.stdout.write(
      `${JSON.stringify({
        status: "ok",
        path: targetPath,
        beforeBytes,
        afterBytes,
      })}\n`,
    );
  } finally {
    try {
      fs.rmdirSync(lockDir);
    } catch {
      // Ignore lock cleanup errors to keep append behavior robust.
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const filePath =
    String(options.file || "").trim() || path.join(process.cwd(), "memory", "braindump.md");
  const content = decodeContent(options);
  appendBraindump(filePath, content);
}

main();
