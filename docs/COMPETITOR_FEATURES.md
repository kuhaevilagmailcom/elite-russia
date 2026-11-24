# Сравнение
Публичная документация Portals https://docs.portals.tg/developers/api/ подтверждает рыночные данные, покупки, офферы, пополнение, вывод и массовые операции. MRKT/Tonnel: закрытый Mini App не проверялся, детали не приписываются. 
| Возможность | Portals public docs | MINION | Приоритет |
|---|---|---|---|
| Gift custody/deposit/withdraw | documented | read-only adapter | P0 |
| Balance/deposit | documented | TEST ledger, external funding disabled | P0 |
| Offers/collection offers/bulk buys | documented | sandbox engine | P1 |
| Market activity | documented | sandbox activity + SSE | P1 |
| Partner API | documented | local API only, no scopes | P2 |
Не переносить валюту и разрешения конкурента автоматически на новый сервис.
