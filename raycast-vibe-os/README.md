# Vibe-OS Raycast Extension

Private Raycast front-end for the remote `OpenClaw`-backed Vibe-OS brain.

## Commands

- `Ask Vibe-OS`: ask the remote brain a normal question
- `Dump To Vibe-OS`: send a quick braindump and get a short confirmation back
- `Rewrite With Vibe-OS`: rewrite text with a concise instruction

## Preferences

- `Gateway Base URL`
- `Gateway Token`
- `Agent ID`

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
3. Fill the three extension preferences.
4. Run `Ask Vibe-OS` or `Dump To Vibe-OS`.

## Development

```bash
cd raycast-vibe-os
npm install
npm run dev
```
