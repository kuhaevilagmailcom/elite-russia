# Integration status
- SQLite: verified with local automated HTTP and unit tests.
- PostgreSQL: repository implemented, not executed; no `postgres`/`psql` or installed pg package, npm registry EAI_AGAIN. CI integration test in `tests/postgres.integration.mjs`.
- TON proof: Ed25519 and challenge tests use a fixture resolver. Actual SDK resolver test in `tests/ton-sdk.integration.mjs` requires installed `@ton/ton`. No live wallet; testnet chain value is context, not an independent on-chain attestation. Wallets with rotated or non-default keys are intentionally rejected.
- Telegram: signed initData fixture and mocked official API contracts passed; no bot token, HTTPS, business connection or live calls.
- Browser: blocked; `artifacts/browser-attempt.txt`.
- Redis, signer, real deposit/withdrawal, live custody: not verified/not implemented. No mainnet activation.
