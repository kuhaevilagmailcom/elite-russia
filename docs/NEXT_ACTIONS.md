# Next actions (in priority order)
1. Install PostgreSQL and npm dependencies in an authorized environment; run PG integration tests against a disposable empty DB and the runtime HTTP suite. Verify actual migrations, precision and concurrent locks. Never import demo funds into production.
2. Install TON SDK; run SDK integration test and connect supported wallet on owned HTTPS domain in restricted testnet mode. Add validated wallet implementations and trusted network-provider verification.
3. Add and test testnet deposit scanner/withdrawal state machines; independent signer and reconciliation, then real-world testnet verification. Keep mainnet off.
4. Connect own Telegram bot and own business account; test read-only sync first. Implement verified deposit ownership/event processing and withdrawal queue with exact receipts and audit. Do not send valuable gifts now.
5. Add original media pipeline, complete discovery, Redis/outbox, admin workflows and remaining P1/P2. Run browser QA in allowed environment and independent audit; complete legal/platform checks.
