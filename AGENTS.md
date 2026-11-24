# Rules for development
- Never treat demo assets as real assets; preserve explicit TEST labels.
- Never enable LIVE_FINANCE_ENABLED before external verification, custody reconciliation, independently audited ledger and signer, legal/platform review.
- Use integer minimal units, atomic operations, immutable journal, idempotency and explicit user confirmation.
- No private keys, session credentials or bot tokens in source or logs.
- Keep tests passing and update DEVELOPMENT_STATUS.md with verified results. Follow docs/ORIGINAL_SPEC.md for remaining scope.
