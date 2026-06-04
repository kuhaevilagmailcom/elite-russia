# Launcher public example

This folder describes the public launcher update format.

It does not contain production links, signing keys or real client archives.

## Files

- `manifest.example.json` — safe manifest format.
- `config.example.json` — safe local config example.
- `update-flow.md` — update stage checklist.

## Production note

The real launcher should download manifests from trusted infrastructure, verify hashes and keep all secrets outside the repository.
