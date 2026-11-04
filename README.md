# LIM NFT Parser — Telegram Mini App

Telegram-парсер подарков и Mini App на базе исходного проекта [Limuzinov Scope](https://github.com/kuhaevilagmailcom/-telegram-nft-business-offer-bot).

## Разделение «Каталог» и «Маркет» (v6)

- **Каталог** — базовые типы подарков Telegram из `payments.getStarGifts`, в том числе те, у которых нет предложений перепродажи. Показывает оригинальную анимацию базового стикера (`.tgs`/`.webm`), когда Telegram разрешает его скачать. Первые 30 новых стикеров скачиваются за цикл синхронизации, остальные — в следующих циклах. Типы, обнаруженные в публичных NFT, также остаются в каталоге.
- При выборе коллекции открываются **все уже известные конкретные NFT этой коллекции**: выставленные и невыставленные, если невыставленные добавлены по публичной ссылке. Telegram не предоставляет открытый общесистемный список всех чужих приватных и невыставленных экземпляров.
- **Маркет** — только конкретные NFT с объявлениями, полученными через `payments.getResaleStarGifts`. После успешной полной синхронизации устаревшие объявления помечаются как недоступные, но запись NFT остаётся в каталоге.
- **Избранное** и **Подборки** работают как раньше. Кнопка «Добавить» находится в верхней панели.
- SQLite мигрируется на месте: новая таблица `gift_collections` и поля `is_listed`/`market_seen`; существующая таблица `gifts` и её данные сохраняются.
- API: `GET /api/collections`, `GET /api/market`, `GET /api/gifts`, `GET /api/facets`, `GET /api/collection-animation/{key}`, `GET /api/collection-file/{key}`. `GET /api/health` показывает `build: catalog-market-v6`.
- Пересоберите BotHost из `main`, а не просто перезапустите старый контейнер. Для загрузки базового каталога и оригинальных анимаций нужны корректные `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` и `TELEGRAM_SESSION`.

## Каталог, анимации и источники

- **Анимации** загружаются из Telegram `.tgs` (Lottie) через `/api/animation/{slug}`, с сохранением в `data/animations/`. Если Telegram ограничил доступ, будет использовано статичное превью.
- Изображения и анимации относятся к **конкретному NFT**: его модели, фону и узору. Фон строится по оригинальным цветам; декоративный узор CSS может отличаться от Telegram.
- **Полный каталог NFT не поставляется вместе с кодом**. Для автоматического пополнения реальными подарками, выставленными на перепродажу, настройте `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`; остальные подарки добавляются по публичным ссылкам. Приватные подарки без публичной карточки не индексируются.
- Поиск и фильтры выполняются в SQLite по всей индексированной базе; на экране загружаются страницы по 48 подарков.
- Избранное по точному номеру NFT и сохранённые наборы фильтров находятся в хранилище Telegram WebView **на текущем устройстве**. Между телефонами автоматически не синхронизируются.
- Для интерфейса используются [Lucide](https://lucide.dev) и [lottie-web](https://github.com/airbnb/lottie-web) из CDN. Для корректного отображения анимаций этим скриптам нужен доступ к интернету.
- Команда запуска `python main.py`; **не запускайте `app/static/app.js` из Node.js**.

## Хостинг BotHost

- GitHub: `kuhaevilagmailcom/elite-russia` (ветка `main`).
- Команда запуска: `python main.py`.
- Переменная `BOT_TOKEN`: токен бота из @BotFather — **только в настройках хостинга**, не в GitHub.
- `PUBLIC_URL=https://bot-1790259314-9532-furadev.bothost.tech`: адрес Mini App, который открывает кнопка.
- `ALLOW_DEMO_DATA=false`: отключение демонстрационных подарков.
- `DATABASE_PATH=data/gifts.db`: подключите постоянное хранение, чтобы не терять данные после перезапуска контейнера.
- Для HTTP-прокси используется `PORT` от хостинга (по умолчанию 8000).

После установки переменных перезапустите сервис. Для запуска через `https://t.me/TelegraGiftsOff_bot/limyzinovParser` настройте Mini App на этот HTTPS-адрес в @BotFather. Токен в `BOT_TOKEN` должен принадлежать `@TelegraGiftsOff_bot`, если нужен именно этот бот.

## Команда /start

Бот пишет: «Салам, @ник, ёпта! Это мой парсер NFT.» и показывает кнопку **«Открыть апп»**, запускающую Mini App. При отсутствии username использует имя пользователя.

## Запуск локально

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python main.py
```

Без `BOT_TOKEN` веб-приложение доступно локально и бот не запускается.

## Тесты

```powershell
pip install -r requirements-dev.txt
python -m pytest -q
```

## Функциональность


Telegram-бот «Лимузинов Скоп» и Mini App для поиска collectible gifts по подарку, владельцу, модели, фону и узору. Публичная карточка `t.me/nft/...` парсится напрямую; цена хранится как отдельная ориентировочная оценка с источником.

## Быстрый запуск

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Откройте `http://localhost:8000`. Без токена работает Mini App и демо-каталог. Чтобы запустить бота, добавьте в `.env`:

```env
BOT_TOKEN=123456:ABC...
PUBLIC_URL=https://your-https-domain.example
```

Если нужны именно premium emoji в сообщениях, укажите `custom_emoji_id` в полях `EMOJI_GIFT_ID`, `EMOJI_OWNER_ID`, `EMOJI_MODEL_ID`, `EMOJI_PRICE_ID`. Без них бот использует аккуратные обычные emoji.

Для Telegram Mini App нужен публичный HTTPS URL. Укажите его у @BotFather через `/newapp`, а inline-поиск включите через `/setinline`.

## Что умеет

- поиск по коллекции, владельцу, номеру, модели, фону и узору;
- фильтры по всем трём collectible-атрибутам;
- импорт и обновление подарка по ссылке `t.me/nft/...`;
- короткая карточка в боте, `/find` и inline mode;
- локальное избранное в Mini App;
- SQLite-индекс без внешней инфраструктуры;
- отдельные поля для Stars, TON, USD, источника и даты оценки.
- фоновая синхронизация всех подарков, выставленных на перепродажу в Telegram.

## Полный рынок перепродажи

Официальный `payments.getResaleStarGifts` доступен только пользовательской MTProto-сессии. Добавьте `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` и заранее созданную `TELEGRAM_SESSION` в `.env`. После этого приложение каждые 15 минут получает все страницы доступных к покупке подарков, владельцев, цены и атрибуты. Разовый запуск:

```powershell
python -m app.resale_sync
```

Если у владельца есть публичный username, карточка показывает «Написать владельцу». При скрытом username интерфейс честно оставляет только ссылку на сам подарок.

## Важно о ценах

Данные владельца и атрибуты берутся из публичной Telegram-карточки. Демо-цены в стартовом каталоге специально отмечены как `Демо-оценка` и не являются рыночной котировкой. Для продакшена подключите официальный MTProto `payments.getUniqueStarGiftValueInfo` или проверенный marketplace feed и обновляйте `price_source`/`price_updated_at`.

## Проверка

```powershell
python -m pytest -q
```

## Docker

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

После публикации на HTTPS-домене укажите адрес Mini App в @BotFather и тот же адрес в `PUBLIC_URL`. Команда `/start` отвечает приветствием с кнопкой «Открыть апп».

