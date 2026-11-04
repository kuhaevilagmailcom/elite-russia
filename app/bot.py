from __future__ import annotations

import hashlib
from html import escape

from aiogram import Bot, Dispatcher, F, Router
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    InlineKeyboardButton, InlineKeyboardMarkup, InlineQuery, InlineQueryResultArticle,
    InputTextMessageContent, Message, User, WebAppInfo,
)

from app.config import Settings
from app.db import Database
from app.parser import GiftParseError, fetch_gift


def _emoji(fallback: str, custom_id: str) -> str:
    return f'<tg-emoji emoji-id="{custom_id}">{fallback}</tg-emoji>' if custom_id else fallback


def gift_text(gift: dict, settings: Settings | None = None) -> str:
    settings = settings or Settings()
    price = f"≈ {gift['price_stars']:,} ⭐".replace(",", " ") if gift.get("price_stars") else "Цена уточняется"
    return (
        f"{_emoji('🎁', settings.emoji_gift_id)} <b>{escape(gift['collection'])} #{gift['number']}</b>\n"
        f"{_emoji('👤', settings.emoji_owner_id)} {escape(gift['owner_name'])}\n"
        f"{_emoji('✨', settings.emoji_model_id)} {escape(gift['model'])} · 🎨 {escape(gift['backdrop'])} · ◌ {escape(gift['symbol'])}\n"
        f"{_emoji('💎', settings.emoji_price_id)} {price}"
    )


def gift_keyboard(gift: dict, webapp_url: str) -> InlineKeyboardMarkup:
    first_row = []
    if gift.get("owner_url"):
        first_row.append(InlineKeyboardButton(text="Написать владельцу", url=gift["owner_url"]))
    first_row.append(InlineKeyboardButton(text="Открыть подарок", url=gift["source_url"]))
    return InlineKeyboardMarkup(inline_keyboard=[
        first_row,
        [InlineKeyboardButton(text="Найти похожие", web_app=WebAppInfo(url=f"{webapp_url}/?similar={gift['slug']}"))],
    ])


def start_text(user: User | None) -> str:
    nick = (f"@{user.username}" if user and user.username
            else user.full_name if user else "друг")
    return f"Салам, <b>{escape(nick)}</b>, ёпта! Это мой парсер NFT."


async def run_bot(db: Database, settings: Settings) -> None:
    bot = Bot(settings.bot_token)
    router = Router()

    @router.message(CommandStart())
    async def start(message: Message):
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="Открыть апп", web_app=WebAppInfo(url=settings.webapp_url))],
        ])
        await message.answer(
            start_text(message.from_user),
            reply_markup=keyboard,
            parse_mode=ParseMode.HTML,
        )

    @router.message(Command("find"))
    async def find(message: Message):
        query = (message.text or "").partition(" ")[2]
        items = db.search(query, limit=5)
        if not items:
            await message.answer("Ничего не нашёл. Попробуй владельца, название модели или ссылку на подарок.")
            return
        for gift in items:
            await message.answer(gift_text(gift, settings), reply_markup=gift_keyboard(gift, settings.webapp_url), parse_mode=ParseMode.HTML)

    @router.message(F.text.regexp(r"(?:t\.me|telegram\.me)/(?:nft/)?[\w-]+-\d+"))
    async def import_link(message: Message):
        status = await message.answer("⏳ Проверяю подарок…")
        try:
            gift = db.upsert(await fetch_gift(message.text or ""))
        except GiftParseError as exc:
            await status.edit_text(str(exc))
            return
        except Exception:
            await status.edit_text("Telegram не отдал карточку. Попробуй ещё раз чуть позже.")
            return
        await status.edit_text(gift_text(gift, settings), reply_markup=gift_keyboard(gift, settings.webapp_url), parse_mode=ParseMode.HTML)

    @router.message(F.text)
    async def plain_search(message: Message):
        items = db.search(message.text or "", limit=3)
        if not items:
            await message.answer("Ничего не нашёл. Пришли ссылку t.me/nft/... — добавлю подарок в индекс.")
            return
        for gift in items:
            await message.answer(gift_text(gift, settings), reply_markup=gift_keyboard(gift, settings.webapp_url), parse_mode=ParseMode.HTML)

    @router.inline_query()
    async def inline_search(query: InlineQuery):
        results = []
        for gift in db.search(query.query, limit=20):
            result_id = hashlib.sha1(gift["slug"].encode()).hexdigest()
            results.append(InlineQueryResultArticle(
                id=result_id, title=f"{gift['collection']} #{gift['number']}",
                description=f"{gift['model']} · {gift['backdrop']} · {gift['symbol']}",
                input_message_content=InputTextMessageContent(message_text=gift_text(gift, settings), parse_mode=ParseMode.HTML),
                reply_markup=gift_keyboard(gift, settings.webapp_url),
            ))
        await query.answer(results, cache_time=10, is_personal=True)

    dp = Dispatcher()
    dp.include_router(router)
    await bot.delete_webhook(drop_pending_updates=False)
    await dp.start_polling(bot)

