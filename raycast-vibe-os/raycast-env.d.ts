/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** 网关地址 - 本地 SSH 隧道地址或 OpenClaw 网关地址 */
  "baseUrl": string,
  /** 网关令牌 - 调用 /v1/responses 所需的 Bearer Token */
  "gatewayToken": string,
  /** Agent ID - 要连接的 OpenClaw agent 标识 */
  "agentId": string,
  /** Dump SSH Target - 倾倒写盘使用的 SSH 目标，格式 user@host */
  "dumpSshTarget": string,
  /** Dump SSH Key Path - 倾倒写盘使用的 SSH 私钥路径 */
  "dumpSshKeyPath": string,
  /** Dump Workspace Root - 部署机 workspace 根路径（写 memory/braindump.md） */
  "dumpRemoteWorkspaceRoot": string,
  /** Dump Script Path - 部署机统一写入器脚本绝对路径 */
  "dumpRemoteScriptPath": string,
  /** Dump SSH Timeout Sec - 倾倒写盘 SSH 连接超时秒数 */
  "dumpSshConnectTimeoutSec": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `ask-vibe-os` command */
  export type AskVibeOs = ExtensionPreferences & {}
  /** Preferences accessible in the `dump-to-vibe-os` command */
  export type DumpToVibeOs = ExtensionPreferences & {}
  /** Preferences accessible in the `rewrite-with-vibe-os` command */
  export type RewriteWithVibeOs = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `ask-vibe-os` command */
  export type AskVibeOs = {}
  /** Arguments passed to the `dump-to-vibe-os` command */
  export type DumpToVibeOs = {}
  /** Arguments passed to the `rewrite-with-vibe-os` command */
  export type RewriteWithVibeOs = {}
}

