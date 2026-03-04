# Vibe-OS Raycast Extension

Private Raycast front-end for the remote `OpenClaw`-backed Vibe-OS brain.

## Commands

- `问问 Vibe-OS`: ask the remote brain a normal question
- `倾倒到 Vibe-OS`: write braindump via deterministic SSH append, then return a short confirmation
- `用 Vibe-OS 改写`: rewrite text with a concise instruction

`倾倒到 Vibe-OS` uses the shared writer script:

- `scripts/append_braindump_entry.mjs`

## Preferences

- `Gateway Base URL`
- `Gateway Token`
- `Agent ID`
- `Dump SSH Target`
- `Dump SSH Key Path`
- `Dump Workspace Root`
- `Dump Script Path`
- `Dump SSH Timeout Sec`

Recommended local value for `Gateway Base URL`:

```text
http://127.0.0.1:28789
```

That assumes this Mac keeps an SSH tunnel open to the remote deployment Mac:

```bash
ssh -N -L 28789:127.0.0.1:18789 kris@annkimac.tail7f9f42.ts.net
```

## Setup

1. Keep the SSH tunnel open.
2. Open Raycast and import or develop this extension from `raycast-vibe-os/`.
3. Fill the extension preferences (gateway + dump SSH fields).
4. Run `问问 Vibe-OS` or `倾倒到 Vibe-OS`.

Recommended dump path values for the current deployment machine:

```text
Dump Workspace Root: /Users/kris/instances/vibe-os/workspace
Dump Script Path: /Users/kris/Desktop/Dev/Vibe-OS/scripts/append_braindump_entry.mjs
```

## Development

```bash
cd raycast-vibe-os
npm install
npm run dev
```

Notes:

- This extension pins its local npm registry to `https://registry.npmjs.org` via `.npmrc` so it does not inherit a slow or incomplete global mirror.
- To replace the icon later, overwrite `raycast-vibe-os/assets/icon.png` with a `512x512` PNG and rerun `npm run lint`.
