# USERNAME 7.5.0 — deployment and operations

## Required environment

- `BOT_TOKEN`: Telegram bot token; keep it outside git.
- `WEBAPP_URL`: absolute public HTTPS address of the deployed Mini App.
- `ADMIN_IDS`: **required** comma-separated Telegram numeric IDs of real administrators, e.g. `ADMIN_IDS=123456789,987654321`. The former hard-coded IDs were removed. Without this variable, admin functions will be unavailable.
- `NODE_ENV=production`; `ALLOW_DEV_AUTH` must remain disabled in production.
- `DATA_DIR`: persistent SQLite data directory (default: `./data`).
- `BACKUP_DIR`: persistent backup directory; preferably a separate disk/volume with additional off-site backups, e.g. `/mnt/backups/username`. Defaults to `DATA_DIR/backups`.
- `PAY_SUPPORT_CONTACT`: optional support address/username displayed if the payment support command cannot be handled.

## Before deployment

1. Make an independent copy of the existing database and back it up off-host. The app's local SQLite backups alone are not disaster recovery.
2. Set `ADMIN_IDS` on the hosting panel before deploying this branch or merging it to `main`. Test `/admin` with your authorized Telegram account.
3. Verify the website is served over HTTPS, accessible from Telegram on iOS/Android, and that `/healthz` reports `db: true` and `backupOk: true`.
4. Run `npm ci` and `npm test`; check the pull-request CI result.
5. Test that a public profile response contains no `telegramId` or `telegram_id`, and that old Telegram usernames are removed after the user changes or deletes them.
6. Test on low-height mobile screens, dark/light mode, 200% text zoom, and system Reduced Motion.

## Stars purchases / support

- Users send `/paysupport issue description` to the bot.
- The bot forwards payment enquiries to configured `ADMIN_IDS`; an admin replies with `/supportreply <numeric_chat_id> <reply>`.
- Purchases appear in Mini App Admin > Платежи; authorized admins may request a Telegram Stars refund using its button.
- Refund outcomes are recorded in the payment table and admin audit log; the UI marks payments as refunded.
- If the purchased gems were already spent, a refund records a `refund_shortfall_gems` for manual review. Review these cases; the refund path cannot retroactively reclaim redeemed cosmetic items.
- Unexpected failures after a provider-confirmed refund need manual reconciliation with Telegram charge IDs. Never click refund repeatedly to work around an unresolved network/server failure.
- Verify your Telegram Bot API `refundStarPayment` permissions and your own customer service procedures.

## Data handling and limitations

- Public player profiles omit Telegram IDs; private administrative views can still show them to authenticated admins.
- The active leaderboard uses a seven-day activity window.
- Notifications retain the 300 most recent items per user.
- Built-in backups are local or configurable to a mounted location. You must implement independent off-site copies, retention policies and a restore drill on your infrastructure.
- Do not disclose real identifying details in public profiles, exports or screenshots.
