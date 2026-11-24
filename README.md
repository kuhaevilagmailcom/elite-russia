# MINION MARKET 1.0 RC

Telegram Mini App marketplace release candidate for collectible gifts. It combines a compact black/yellow storefront, Telegram Web App authentication, Telegram collectible metadata, TON Proof, a transactional TEST GRAM trading engine, free giveaways, PostgreSQL support, an embedded Telegram webhook bot and BotHost-compatible Docker runtime.

This repository is deliberately fail-closed. Real deposits, withdrawals and gift transfers remain disabled until custody reconciliation, signer/ledger audit, legal/platform review and external Telegram/TON verification are complete. Development mode contains clearly labelled TEST gifts and TEST GRAM only.

## Run locally

Requirements: Node.js 22.13 or newer.

```powershell
Copy-Item .env.example .env
npm ci
node --env-file=.env --experimental-sqlite server-async.mjs
```

- Market: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin`
- Liveness: `http://localhost:3000/health`
- Readiness: `http://localhost:3000/ready`
- TON Connect manifest: `http://localhost:3000/tonconnect-manifest.json`

Checks:

```powershell
npm run check
npm test
node --test tests/ton-sdk.integration.mjs
```

## BotHost

Build with the repository `Dockerfile`; no separate start command is required. The container listens on `0.0.0.0:$PORT`, installs production dependencies and exposes a readiness healthcheck. The same Node process serves the Mini App and handles Telegram webhook updates, so polling/webhook duplicates are not created.

Required restricted preview variables:

```text
APP_ENV=restricted
APP_URL=https://YOUR-BOTHOST-DOMAIN
PORT=3000
BIND_HOST=0.0.0.0
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
TON_NETWORK=testnet
DATABASE_DRIVER=postgres
DATABASE_URL=postgresql://...
MARKET_CURRENCY=GRAM
LIVE_FINANCE_ENABLED=false
LIVE_CUSTODY_ENABLED=false
```

`BOT_TOKEN` is accepted as an alias for `TELEGRAM_BOT_TOKEN`; conflicting values fail startup without logging either secret. See `.env.example` for the complete list.

On startup with a valid bot token and HTTPS `APP_URL`, the service verifies `getMe`, registers `/start`, `/market`, `/inventory`, `/wallet`, `/offers`, `/giveaways`, `/profile`, `/support`, `/help`, installs the `Маркет` menu button and configures the webhook at `/telegram/webhook`.

## Implemented and verified locally

- Telegram initData HMAC, expiry and replay protection.
- Hashed bearer sessions and role-separated admin APIs.
- Atomic quotes, purchases, listings, offers, collection offers, bundles, swaps and ledger reconciliation in the sandbox.
- Free giveaways with atomic prize locking, unique entries, server-side winner selection and immutable ownership transfer.
- Official Telegram Bot API metadata import for unique gifts; metadata import never grants ownership.
- Server-side Telegram media proxy with validation, size cap and bounded cache; the bot token is never exposed to the browser.
- TON Proof nonce/session/domain/network/signature verification for supported fixed-key V3R2/V4 wallets.
- Responsive 320/375/390/430 px mobile and 1440 px desktop layouts, safe areas and bottom sheets.
- SQLite sandbox and explicit PostgreSQL adapter/migrations.

## Not production-verified

- Real Telegram Business custody deposit/withdraw transfer.
- GRAM blockchain scanner, confirmations, treasury signer and withdrawal pipeline.
- Production PostgreSQL concurrency and backup/restore on the target host.
- External Telegram client `/start`, deployed HTTPS Mini App and real-wallet TON Proof.
- Independent financial/security audit and legal/platform approval.

Never enable live finance or custody from an unreviewed deployment. Never commit `.env`, bot tokens, Telegram sessions, private keys, database files or seed phrases.

The previous Python/BotHost implementation is preserved in `legacy-python/` for rollback and reference. It is excluded from the release container.
