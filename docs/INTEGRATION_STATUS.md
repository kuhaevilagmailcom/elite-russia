# Integration status

- SQLite: verified locally with the automated HTTP/unit suite (74 Node tests).
- PostgreSQL: repository adapter, migration and GitHub CI service integration are implemented; no target production database is available locally. The disposable-database test is `tests/postgres.integration.mjs`.
- TON proof: two local `@ton/ton` integration tests pass for fixed-key V4/V5R1 address/StateInit matching and actual Ed25519 signatures. No external wallet or on-chain transaction was performed. Testnet chain configuration is not an independent on-chain attestation; rotated or non-default wallet keys remain rejected.
- Telegram: signed initData fixtures and mocked official API contracts pass; no live bot token, business connection or real Telegram client was used.
- Browser: Chromium and WebKit QA pass at 320, 360, 375, 390, 430, 768 and 1440 px, including local assets, console/page errors, responsive navigation, primary screens and modal interaction. This is not a live Telegram WebView verification.
- Redis, production signer, real deposit/withdrawal and live custody: not verified or not implemented. No mainnet activation.
