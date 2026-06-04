# ELITE RUSSIA

ELITE RUSSIA is a CRMP / SA-MP multiplayer ecosystem project.

This repository contains the public parts of the project: CEF interface examples, CEF ↔ Pawn contracts, launcher architecture notes, manifest examples and small helper tools used by the development team.

The private game mode, production launcher keys, server configuration, database credentials and game assets are intentionally not included.

## What is inside

- `cef-interfaces/` — small CEF interfaces and shared bridge code.
- `pawn-contracts/` — Pawn-side examples for opening interfaces and receiving callbacks.
- `launcher/` — launcher update flow documentation and safe manifest examples.
- `docs/` — architecture notes, project roadmap and maintenance policy.
- `website/` — public frontend examples for the project website.
- `.github/` — issue templates, pull request template and basic CI checks.

## Project goals

The main goal is to make CRMP / SA-MP development easier to maintain:

- one clean contract between CEF and Pawn;
- predictable launcher updates;
- documented interface callbacks;
- fewer duplicated bridge implementations;
- safer public examples without leaking production files.

## Current status

Active development.  
The public repository is maintained as a documentation and examples package for the project team and contributors.

## Local preview

Open any interface entry point directly in a browser:

```text
cef-interfaces/auth/index.html
cef-interfaces/register/index.html
cef-interfaces/skins/index.html
cef-interfaces/bank/index.html
cef-interfaces/atm/index.html
cef-interfaces/hud/index.html
```

For CEF builds inside the game client, keep paths stable and load files from the expected `cef/` directory.

## Safety

Do not commit:

- API keys;
- Telegram bot tokens;
- S3 or CDN credentials;
- production database configuration;
- full client archives;
- paid or third-party game assets.

Use the example config files as a base and keep real production values outside the repository.
