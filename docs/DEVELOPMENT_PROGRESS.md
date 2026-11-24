# Beta 2 development progress
- Preserved all 34 baseline tests; reran before modifications. Git baseline created before edits.
- Added shared asynchronous generated core and HTTP server, SQLite and pg repositories, explicit driver selection, actual schema migration command and PG CI test.
- Moved financial integrity check inside transaction; protected initial seeding/session migration against startup race. Ledger V2 incremental projections and reconciliation added to async runtime.
- Added TON proof message verification, one-use challenge tied to stored session, SDK-based fixed-wallet resolver, UI integration, local Ed25519 tests.
- Added official single-collectible metadata adapter and persistent cache, custody observation/reconciliation service with no credit, role matrix and scoped endpoints.
- 17 additional local tests. `npm test`: 51/51; `npm run check`: success. PG and actual SDK tests not included in 51; separate CI tests prepared.
- Browser navigation attempted again; blocked by local administrative policy. No screenshots or remote CI.
