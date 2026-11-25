# MINION MARKET 1.0 RC — verified status

Date: 2026-11-25. Release candidate; not approved for mainnet or real custody.

| Area | State | Current evidence |
|---|---|---|
| Node/SQLite runtime | VERIFIED | `/health` and `/ready` return 200; 56 local tests pass |
| Trading engine | SANDBOX VERIFIED | Atomic TEST purchases, listings, offers, bundles, swaps, idempotency and race tests |
| Free giveaways | SANDBOX VERIFIED | Prize lock, duplicate-entry rejection, winner transfer unit test and Chromium organizer/participant flow |
| Telegram bot | CONTRACT TESTED | Webhook, required commands, exact `/start` copy, Menu Button and deep section links; real token not available |
| Telegram auth | INTEGRATION TESTED | Signed local fixtures, expiry and replay tests; real Telegram client not run |
| Collectible metadata | ADAPTER TESTED | Official `getUniqueGift`, safe DTO/media proxy; no real token/live catalog call |
| TON Proof | SDK TESTED | Real `@ton/ton` 16.3 V4 StateInit/address plus Ed25519 test; external wallet/HTTPS unverified |
| PostgreSQL | IMPLEMENTED | Adapter and CI service exist; target production DB not available locally |
| Docker/BotHost | IMPLEMENTED | Dependency install, `0.0.0.0:$PORT`, one web+webhook process, readiness HEALTHCHECK |
| Browser | VERIFIED LOCALLY | Chromium console clean; screenshots at 320×568, 375×667, 390×844, 430×932, 1440×900; no horizontal body overflow |
| Real GRAM finance | DISABLED | No scanner/signer/withdrawal reconciliation; must remain disabled |
| Gift custody movement | DISABLED | Observation-only adapter; no ownership credit or transfer worker |

Residual dependency note: `npm audit --omit=dev` reports the current upstream Zod collection-memory advisory through `@ton/ton`; npm provides no compatible automated fix. The only untrusted StateInit accepted by this service is capped at 24 KB before TON SDK parsing. Re-check before deployment.

## Proposed personal gift import and mainnet wallet connection
User-scoped read-only Telegram gift references are stored separately from tradable inventory; ownership visibility is checked on import/refresh, not continuously. Mainnet TON Proof connection is supported as a read-only configuration; supported fixed-key wallet contracts only. No live transfer, sale or balance credit. New tests added; CI and live Telegram/mainnet verification pending.

## Reference UI update
Implemented the user-supplied dark/yellow home reference with a cropped decorative mascot, live account statistics, real inventory references, working shortcuts, a separate sales view and matching navigation. VIP and wheel are not invented; existing offers and giveaways are linked. Finance and custody restrictions are unchanged. Visual/live deployment verification pending.

## Narrow viewport regression fix (2026-11-25)
Main CI run 45517181766 passed Node, TON SDK, PostgreSQL and secret checks but failed Chromium at 320px. Constrain header and navigation intrinsic widths, add overflow diagnostics and disambiguate duplicate navigation targets in browser QA. Verification pending on this branch.

### Reference banner follow-up
CI on 18425fb failed at 320px: banner right edge 354.72px. Explicit inline width and maximum width prevent min-height/aspect-ratio from expanding the banner outside its shell. Added a banner bounds regression assertion; CI pending.

## Personal gift video preview (2026-11-25)
Main CI 45539807457 succeeded. Proposed original Telegram WebM sticker playback for personal gift references with thumbnail fallback, viewport-aware playback and reduced-motion support. No ownership or custody changes. TGS rendering and live Telegram verification remain pending. New adapter test added; branch CI pending.

## Motion and navigation accessibility (2026-11-25)
Main CI 45553829890 passed after WebM preview merge. Proposed short button feedback and sheet entrance animations, reduced-motion overrides, touch hover suppression, accessible dialog title and current navigation state. Browser regression assertions added; branch CI pending. No finance or custody changes.

## Storefront and TGS revision
Previous motion PR merged after green CI. Home shows public listings/catalog, not private inventory. Local MIT Phosphor navigation icons, blue GRAM mark based on official media description (not original download), removed cropped banner image. Vendored Lottie Light 5.13.0 and bounded TGS JSON decoder enable original Telegram vector animation. Existing imports need re-check for new animation IDs. Live Telegram media and new CI pending. Financial restrictions unchanged.

Wallet proof: default Wallet V5R1 supported for mainnet and testnet, retaining state-init/address/signature matching. Added network mismatch feedback and stale connection reset. Existing private gifts refresh animation metadata in one bounded Telegram gift scan once per session. New CI and real Telegram verification pending. No transfer or payment enabled.
