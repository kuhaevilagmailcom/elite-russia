# LIM NFT Parser — Telegram Mini App

Telegram-парсер подарков и Mini App на базе исходного проекта [Limuzinov Scope](https://github.com/kuhaevilagmailcom/-telegram-nft-business-offer-bot).

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

