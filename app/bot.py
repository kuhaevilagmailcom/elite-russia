"""MRKT giveaway broadcast bot; replaces the old NFT search commands."""
from __future__ import annotations

import asyncio
import logging
from html import escape

from aiogram import Bot, Dispatcher, Router
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError, TelegramRetryAfter
from aiogram.filters import Command, CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, User

from app.config import Settings
from app.db import Database
from app.mrkt_notifier import BroadcastStore, MRKTFeed, format_giveaway

LOG = logging.getLogger(__name__)


def start_text(user: User | None) -> str:
    nick = f'@{user.username}' if user and user.username else user.full_name if user else 'друг'
    return (
        f'Привет, <b>{escape(nick)}</b>! 🎁\n\n'
        'Ты подписан на уведомления о новых <b>бесплатных и платных розыгрышах MRKT</b>.\n'
        'Присылаю подарок, цену билета, участников, количество билетов, срок и ссылки.\n\n'
        'Команды: /latest — последние; /status — статус; /stop — отключить уведомления.'
    )


def giveaway_keyboard(item: dict) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text='Открыть розыгрыши MRKT', url=item['url'])]]
    if item.get('nft'):
        rows.insert(0, [InlineKeyboardButton(text='Посмотреть NFT', url=item['nft'])])
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def notify_pending(bot: Bot, store: BroadcastStore) -> None:
    for chat_id, item in store.pending(40):
        try:
            await bot.send_message(
                chat_id, format_giveaway(item),
                parse_mode=ParseMode.HTML,
                reply_markup=giveaway_keyboard(item),
                disable_web_page_preview=True,
            )
        except TelegramRetryAfter as exc:
            store.retry(chat_id, item['key'], int(exc.retry_after) + 2)
            break
        except TelegramForbiddenError:
            store.unsubscribe(chat_id)
        except TelegramBadRequest as exc:
            message = str(exc).lower()
            if 'chat not found' in message or 'user is deactivated' in message:
                store.unsubscribe(chat_id)
            else:
                LOG.warning('Telegram rejected notification for %s: %s', chat_id, exc)
                store.retry(chat_id, item['key'], 300)
        except Exception as exc:
            LOG.warning('Delivery failed for %s: %s', chat_id, type(exc).__name__)
            store.retry(chat_id, item['key'], 90)
        else:
            store.mark_delivered(chat_id, item['key'])
        await asyncio.sleep(0.08)


async def monitor_loop(bot: Bot, store: BroadcastStore, settings: Settings) -> None:
    interval = max(60, min(3600, settings.mrkt_poll_seconds))
    while True:
        try:
            feed = MRKTFeed(settings.mrkt_token, settings.mrkt_auth_mode, pages=settings.mrkt_pages)
            items = await feed.fetch_all()
            if settings.mrkt_watch_types in {'paid', 'free'}:
                wanted = settings.mrkt_watch_types.title()
                items = [item for item in items if item['type'] == wanted]
            if settings.mrkt_max_paid_ton > 0:
                items = [item for item in items if item['type'] == 'Free' or item['price_ton'] is not None and item['price_ton'] <= settings.mrkt_max_paid_ton]
            new = store.insert_feed(
                items,
                notify_existing=settings.mrkt_notify_existing,
                initial_limit=settings.mrkt_initial_limit,
            )
            LOG.info('MRKT feed: received %d items, new %d, subscribed %d', len(items), new, store.count_subscribers())
        except Exception as exc:
            LOG.warning('MRKT scan failed: %s', exc)
        await asyncio.sleep(interval)


async def delivery_loop(bot: Bot, store: BroadcastStore) -> None:
    """Drain pending notifications independently from the feed polling interval."""
    while True:
        try:
            await notify_pending(bot, store)
        except Exception as exc:
            LOG.warning('Notifier cycle failed: %s', exc)
        await asyncio.sleep(2)


async def run_bot(db: Database, settings: Settings) -> None:
    del db  # The legacy NFT Mini App uses its own catalog.
    bot = Bot(settings.bot_token)
    store = BroadcastStore(settings.database_path)
    router = Router()

    @router.message(CommandStart())
    async def start(message: Message):
        if not message.chat or message.chat.type != 'private':
            await message.answer('Для личных уведомлений открой бота в личных сообщениях и нажми /start.')
            return
        store.subscribe(message.chat.id)
        await message.answer(start_text(message.from_user), parse_mode=ParseMode.HTML)
        latest_items = store.latest(max(1, min(5, settings.mrkt_initial_limit)))
        if latest_items:
            await message.answer('🔥 Активные розыгрыши MRKT прямо сейчас:')
            for item in latest_items:
                await message.answer(
                    format_giveaway(item), parse_mode=ParseMode.HTML,
                    reply_markup=giveaway_keyboard(item), disable_web_page_preview=True,
                )

    @router.message(Command('stop'))
    async def stop(message: Message):
        if not message.chat or message.chat.type != 'private':
            return
        store.unsubscribe(message.chat.id)
        await message.answer('Уведомления отключены. Чтобы включить снова, отправь /start.')

    @router.message(Command('status'))
    async def status(message: Message):
        if not message.chat or message.chat.type != 'private':
            return
        subscribed = store.is_active(message.chat.id)
        await message.answer(
            ('✅ Уведомления включены.' if subscribed else '⏸ Уведомления выключены. Нажми /start.')
            + f'\n👥 Подписчиков бота: {store.count_subscribers()}'
            + '\n🔎 MRKT проверяется автоматически на сервере.'
        )

    @router.message(Command('latest'))
    async def latest(message: Message):
        if not message.chat or message.chat.type != 'private':
            return
        items = store.latest(5)
        if not items:
            await message.answer('Пока нет доступных розыгрышей. Если MRKT API недоступен, подожди следующей проверки.')
            return
        for item in items:
            await message.answer(
                format_giveaway(item), parse_mode=ParseMode.HTML,
                reply_markup=giveaway_keyboard(item), disable_web_page_preview=True,
            )

    @router.message(Command('help'))
    async def help_command(message: Message):
        await message.answer('🎁 /start — подписаться\n🔕 /stop — отключить\n🔎 /latest — последние 5\n📊 /status — состояние подписки')

    dp = Dispatcher()
    dp.include_router(router)
    monitor_task = asyncio.create_task(monitor_loop(bot, store, settings))
    delivery_task = asyncio.create_task(delivery_loop(bot, store))
    try:
        await bot.delete_webhook(drop_pending_updates=False)
        await dp.start_polling(bot, handle_signals=False)
    finally:
        monitor_task.cancel()
        delivery_task.cancel()
        await asyncio.gather(monitor_task, delivery_task, return_exceptions=True)
        await bot.session.close()
