# Vendor Sources

This repository vendors upstream source trees directly into the root workspace.
They are tracked here as ordinary directories, not as submodules.

## OpenClaw

- Upstream: `https://github.com/openclaw/openclaw.git`
- Imported branch: `main`
- Imported base commit: `5d51e9953724989136ba1d97879522ed9b1bd1a0`
- Local status at import time: clean working tree

## Update Policy

Treat vendored directories as upstream snapshots.

Recommended future update flow:

1. Fetch the target upstream repo in a temporary clone.
2. Compare the current pinned commit above with the target upstream commit.
3. Copy or merge the required upstream changes into this repository.
4. Re-test Vibe-OS integration points.
5. Update this file with the new pinned commit.

Do not run `git pull` inside vendored directories after this repository is initialized as the canonical root repo.
