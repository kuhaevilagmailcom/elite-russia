# Платформенная совместимость (публичные документы проверены 24.11.2026)
| Функция | Документ | Статус |
|---|---|---|
| initData | https://core.telegram.org/bots/webapps | HMAC и время, replay; проверка локальной подписи |
| Обычные подарки | https://core.telegram.org/bots/api#getavailablegifts | read-only adapter, не полный collectible catalog |
| Custody | https://core.telegram.org/bots/api#getbusinessaccountgifts | требуется собственная business connection и права; только чтение |
| Transfer | https://core.telegram.org/bots/api#transfergift | выключено, требуются разрешения и фактическая проверка |
| TON Proof | https://docs.ton.org/applications/ton-connect/how-to/ton-proof | не реализован |
| Digital goods | https://core.telegram.org/bots/payments-stars | для применимых цифровых продаж обязательны Stars; конкретная модель перепродажи требует отдельного согласования |
| Reporting | https://core.telegram.org/api/gift-marketplaces | требует доступа, не подключено |

## Beta 2 update
Official TON Proof specification: https://docs.ton.org/applications/ton-connect/how-to/ton-proof — signature and challenge implemented; only default fixed-key V3R2/V4 SDK resolver, not tested with actual SDK or wallet. Network context is not chain verification.
Official unique gift lookup: https://core.telegram.org/bots/api#getuniquegift — adapter and cache by exact name; real API not verified. Custody snapshot: https://core.telegram.org/bots/api#getbusinessaccountgifts — evidence only; no actual transfers, no custody credit. Stars requirements: https://core.telegram.org/bots/payments-stars — applicable routes must be reviewed before launch.
