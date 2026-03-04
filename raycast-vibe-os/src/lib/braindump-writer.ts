import { execFileSync } from "node:child_process";
import os from "node:os";
import { getOpenClawPreferences } from "./openclaw";

const DEFAULT_DUMP_SSH_TARGET = "kris@annkimac.tail7f9f42.ts.net";
const DEFAULT_DUMP_SSH_KEY_PATH = "~/.ssh/id_ed25519_vibe_os_deploy";
const DEFAULT_DUMP_WORKSPACE_ROOT = "/Users/kris/instances/vibe-os/workspace";
const DEFAULT_SSH_CONNECT_TIMEOUT_SEC = 8;

interface DumpWriterConfig {
  sshTarget: string;
  sshKeyPath: string;
  remoteWorkspaceRoot: string;
  sshConnectTimeoutSec: number;
}

interface AppendBraindumpResult {
  status: "ok";
  path: string;
  beforeBytes: number;
  afterBytes: number;
}

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function expandHomePath(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return `${os.homedir()}${value.slice(1)}`;
  return value;
}

function resolveConfig(): DumpWriterConfig {
  const prefs = getOpenClawPreferences();
  const timeout = Number.parseInt(String(prefs.dumpSshConnectTimeoutSec || ""), 10);

  return {
    sshTarget:
      String(prefs.dumpSshTarget || "").trim() || DEFAULT_DUMP_SSH_TARGET,
    sshKeyPath: expandHomePath(
      String(prefs.dumpSshKeyPath || "").trim() || DEFAULT_DUMP_SSH_KEY_PATH,
    ),
    remoteWorkspaceRoot:
      String(prefs.dumpRemoteWorkspaceRoot || "").trim() ||
      DEFAULT_DUMP_WORKSPACE_ROOT,
    sshConnectTimeoutSec:
      Number.isFinite(timeout) && timeout > 0
        ? timeout
        : DEFAULT_SSH_CONNECT_TIMEOUT_SEC,
  };
}

function normalizeBraindumpContent(raw: string): string {
  const normalized = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalized) {
    throw new Error("EMPTY_BRAINDUMP_CONTENT");
  }

  return normalized;
}

function runSshCommand(config: DumpWriterConfig, command: string): string {
  try {
    return execFileSync(
      "ssh",
      [
        "-o",
        "BatchMode=yes",
        "-o",
        "IdentitiesOnly=yes",
        "-o",
        `ConnectTimeout=${config.sshConnectTimeoutSec}`,
        "-o",
        "ConnectionAttempts=1",
        "-i",
        config.sshKeyPath,
        config.sshTarget,
        `bash -lc ${shellQuote(command)}`,
      ],
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  } catch (error) {
    const stderr = String((error as { stderr?: unknown })?.stderr || "").trim();
    const message =
      stderr || String((error as { message?: unknown })?.message || error);
    throw new Error(message);
  }
}

export async function appendBraindumpEntry(
  content: string,
): Promise<AppendBraindumpResult> {
  const config = resolveConfig();
  const normalizedContent = normalizeBraindumpContent(content);
  const remoteBraindumpPath = `${config.remoteWorkspaceRoot}/memory/braindump.md`;
  const remoteAppendScriptPath = `${config.remoteWorkspaceRoot}/scripts/append_braindump_entry.mjs`;
  const contentB64 = Buffer.from(normalizedContent, "utf8").toString("base64");
  const remoteCommand = [
    "set -euo pipefail",
    "if command -v node >/dev/null 2>&1; then",
    '  RUNTIME="node"',
    "elif command -v bun >/dev/null 2>&1; then",
    '  RUNTIME="bun"',
    "elif [ -x /opt/homebrew/bin/node ]; then",
    '  RUNTIME="/opt/homebrew/bin/node"',
    "elif [ -x /usr/local/bin/node ]; then",
    '  RUNTIME="/usr/local/bin/node"',
    "else",
    '  echo "RUNTIME_NOT_FOUND: node/bun not found on remote host" >&2',
    "  exit 127",
    "fi",
    `$RUNTIME ${shellQuote(remoteAppendScriptPath)} \\`,
    `  --file ${shellQuote(remoteBraindumpPath)} \\`,
    `  --content-b64 ${shellQuote(contentB64)}`,
  ].join("\n");

  const stdout = runSshCommand(config, remoteCommand);
  const jsonLine = String(stdout || "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .find((line) => line.trim().startsWith("{"));

  if (!jsonLine) {
    throw new Error("APPEND_FAILED: missing append result payload");
  }

  let parsed: AppendBraindumpResult;
  try {
    parsed = JSON.parse(jsonLine) as AppendBraindumpResult;
  } catch (error) {
    throw new Error(`APPEND_FAILED: invalid append result JSON (${String(error)})`);
  }

  if (parsed.status !== "ok") {
    throw new Error("APPEND_FAILED: append status is not ok");
  }

  return parsed;
}

export function buildDumpAckMessage(content: string): string {
  const text = String(content || "");

  if (/(减脂|撸铁|健身|核心)/i.test(text)) return "核心收紧，走起";
  if (/(美股|crypto|btc|eth|交易|仓位|纳指)/i.test(text)) return "确实逆天，先存证";
  if (/(openclaw|qmd|agent|raycast|脚本|代码|workflow|api)/i.test(text))
    return "牛逼切点，已入库";

  return "秒存";
}

export function toDumpWriteError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.trim();

  if (!message) return "倾倒失败，请稍后再试。";
  if (message.includes("EMPTY_BRAINDUMP_CONTENT")) return "还没写内容";
  if (message.includes("No such file or directory")) return "SSH key 路径不存在，请检查 Raycast 配置。";
  if (message.includes("Permission denied")) return "SSH 鉴权失败，请检查 key 和远程权限。";
  if (message.includes("Connection timed out")) return "SSH 连接超时，请检查隧道或网络。";
  if (message.includes("Could not resolve hostname")) return "远程主机不可解析，请检查 SSH target。";
  if (message.includes("RUNTIME_NOT_FOUND")) return "部署机缺少 node/bun 运行时，请先安装后重试。";
  if (message.includes("LOCK_BUSY")) return "倾倒正在并发写入，稍后重试。";
  if (message.includes("APPEND_FAILED")) return message.replace(/^APPEND_FAILED:\s*/, "");

  return `倾倒失败：${message}`;
}
