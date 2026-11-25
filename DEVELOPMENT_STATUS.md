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

Profile and personal inventory redesigned into compact sections; removed cropped banner image data from stylesheet. Public storefront remains separate from private inventory. Restricted header no longer presents the internal placeholder balance as a real wallet balance. New CI pending.

## Splash and collectible appearance
PR 24 merged after successful CI. User-provided launch image optimized to WebP 320x569, served locally and displayed without cropping until initial render/error; reduced motion supported. Actual Telegram RGB backdrop and symbol thumbnail captured for both public catalog and personal gifts. Private older references upgraded using mediaVersion 3; old public catalog entries require reimport. Repeating pattern placement is approximate; no invented symbol if thumbnail missing. New automated tests and CI pending; live iOS verification still required.

## Wallet overlay regression
PR #25 merged after green CI. Fixed native dialog covering the SDK wallet picker: native sheet is closed before opening SDK and no SDK button is mounted inside it. Only verified or failed status is shown afterward. Regression tests simulate SDK modal and proof callbacks; real iOS client verification remains required. No finance/custody changes.

## MINION Premium 2.0 — design-system refactor
Baseline main f497752 passed CI 45570283222. Replaced accumulated stylesheet with a single token/component system; redesigned shell, home, inventory, sales, profile, cards, dialogs, empty states, responsive navigation. Local Phosphor additions. Preserved original gift media layers, startup image, wallet proof, backend and financial gates. Public listings remain empty until real trading is enabled. Existing official GRAM approximation retained pending asset verification. New browser tests cover compact layout and WebKit in CI; live iOS and visual screenshot review pending.

## MINION Premium 3.0 — inventory-first pass
Baseline b17ce1a7 main CI successful. Implemented grouped inventory without duplicate listed gifts, count grammar, search without rebuilding the input, sort and persisted grid/list preference, 24-card incremental display, real rarity on rechecked private refs (mediaVersion 4), compact actions and confirmation for reference removal. Detail no longer repeats card metadata; sticky sheet header, separate observed status, unavailable trading not shown as active CTA. Removed splash crop from banner, used local Phosphor gift graphic instead; removed redundant shortcuts on private screens. Wallet management separates network balance from test balance. Added fixture browser tests for 30 references; no real financial or custody changes. New CI pending; real iOS, full screenshot review, official GRAM art, advanced multi-select, charts and large-inventory benchmarking remain outstanding.

### Inventory 3.0 follow-up
Initial PR #28 CI failed at the browser test navigating from Sales to a deliberately removed shortcut; restored correct navigation through Home in QA. Added real attribute filters (collection, model, backdrop, symbol), active count, reset, and reuse of unchanged personal gift card DOM during incremental search/sort/view updates to retain Lottie instances. Browser assertions verify card identity and combined filters. CI pending; no financial changes.

## Inventory batch management
PR #28 merged: CI 45580062830 and 45580073906 successful. Added batch selection of personal references, one bounded Telegram scan for selected refs, explicit confirmation for batch removal, scoped transactional operations, accurate missing-from-list status (not proof of lost ownership), and tests for isolation, deduplication, upstream failures and confirmation. Telegram Bot API getUserGifts returns owned AND hosted gifts, so UI explicitly treats matches as observations, not proof of ownership/custody. No transfer or finance enabled. New CI pending; live Telegram tests still required.

## Inventory scale and responsive QA
Baseline main e6670391 passed CI 45585302110. Added browser boundary tests for 0, 1, 20 and 100 private reference fixtures, incremental loading, selection across search, and primary-screen screenshot capture at all seven viewport widths. Fixtures are test-only; no API limit or finance changes. New CI and manual screenshot review pending.

## Activity statistics
Baseline main 48b24cee passed CI 45604511435. Added seven-day UTC count of sold events from the existing activity response, explicitly limited to available history, no fabricated volume or prices. Added event filters and browser fixture assertions. New CI pending; no financial changes or visual acceptance claimed.
