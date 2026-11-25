# Next actions (in priority order)

1. Run the PostgreSQL integration suite against a disposable empty target-like database and the runtime HTTP suite. Verify migrations, numeric precision and concurrent locks. Never import demo funds into production.
2. Connect a supported wallet on an owned HTTPS domain in restricted testnet mode. The local TON SDK tests pass; external wallet UX, trusted provider behavior and network verification remain to be tested.
3. Add and test testnet deposit-scanner and withdrawal state machines, an independent signer and reconciliation, then perform real testnet verification. Keep mainnet off.
4. Connect an owned Telegram bot and business account; test read-only synchronization and the real Mini App client first. Implement verified deposit ownership/event processing and a withdrawal queue with exact receipts and audit. Do not transfer valuable gifts in the current build.
5. Complete media discovery, Redis/outbox and remaining operational workflows. Repeat browser QA in the actual Telegram WebView, then obtain independent security, legal and platform review before enabling live finance or custody.
