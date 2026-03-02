/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Gateway Base URL - Local tunnel or direct OpenClaw gateway URL */
  "baseUrl": string,
  /** Gateway Token - Bearer token used to call /v1/responses */
  "gatewayToken": string,
  /** Agent ID - OpenClaw agent id to talk to */
  "agentId": string
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

