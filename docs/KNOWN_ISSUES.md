# Known issues and blockers
1. No local PostgreSQL, Redis or Docker executables; npm registry DNS EAI_AGAIN. PostgreSQL code and migrations not exercised. No silent SQLite fallback when postgres explicitly selected.
2. PostgreSQL uses a single advisory transaction lock, not the final fine-grained row-lock design. Distributed SSE, Redis rate limits, outbox and job queues still absent.
3. Async generation is source-based and tailored to current engine syntax; edit canonical `core.mjs`, `server.mjs`, `packages/market-safety.mjs` then regenerate and rerun tests. Avoid running legacy server on the same database after ledger projection upgrade.
4. Ledger V2 checks projections and affected reserves per operation; background full reconciliation detects drift elsewhere. No independent security audit, no production reserve/signer verification. A persistent block requires operator investigation; no unsafe reset button.
5. TON proof supports default fixed-key V3R2/V4 only; SDK unavailable locally. No on-chain testnet transactions, deposits, withdrawals, dynamic-wallet key support or actual wallet proof verified.
6. Custody observations are evidence only; no beneficial ownership assignment, gift credit or transfer. Public metadata lookup by exact slug does not discover all collections or download original media.
7. Chromium refused localhost with ERR_BLOCKED_BY_ADMINISTRATOR. No screenshot. CI workflow not run remotely.
8. Production/staging gate remains disabled; no real funds, real asset custody, paid events or staking. Full UI/admin redesign, referrals, cashback, seasons, partner API and setup wizard incomplete.
