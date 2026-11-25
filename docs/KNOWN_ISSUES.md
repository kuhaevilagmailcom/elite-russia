# Known issues and blockers

1. No target PostgreSQL, Redis or Docker runtime is available locally. The PostgreSQL adapter and CI service exist, but the production database, migrations and operational concurrency still require environment-specific verification. No silent SQLite fallback is allowed when PostgreSQL is explicitly selected.
2. PostgreSQL uses a single advisory transaction lock, not the final fine-grained row-lock design. Distributed SSE, Redis rate limits, outbox and job queues remain absent.
3. Async generation is source-based and tailored to current engine syntax; edit canonical `core.mjs`, `server.mjs`, `packages/market-safety.mjs`, then regenerate and rerun tests. Avoid running the legacy server on the same database after ledger projection upgrades.
4. Ledger V2 checks projections and affected reserves per operation; background full reconciliation detects drift elsewhere. No independent security audit or production reserve/signer verification exists. A persistent block requires operator investigation; no unsafe reset button is provided.
5. Local `@ton/ton` integration tests now pass for supported fixed-key V4/V5R1 contracts. External wallet/HTTPS interaction, on-chain testnet transactions, deposits, withdrawals, dynamic-wallet keys and production provider verification remain unverified.
6. Custody observations are evidence only; no beneficial-ownership assignment, gift credit or transfer is enabled. Public metadata lookup by exact slug does not discover every collection.
7. Local Chromium and WebKit QA pass at 320, 360, 375, 390, 430, 768 and 1440 px. Real Telegram/iOS WebView, live bot/business account and production hosting are not verified.
8. Production/staging gates remain disabled: no real funds, real asset custody, paid events or staking. Independent security, legal and platform review is still required before any live activation.
