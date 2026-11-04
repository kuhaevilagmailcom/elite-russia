from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.functions.payments import GetResaleStarGiftsRequest, GetStarGiftsRequest
from telethon.tl.types import (
    PeerChannel,
    PeerUser,
    StarGiftAttributeBackdrop,
    StarGiftAttributeModel,
    StarGiftAttributePattern,
    StarsAmount,
    StarsTonAmount,
)

from app.config import Settings, get_settings
from app.db import Database
from app.catalog import CollectionCatalog


def _rarity(value: Any) -> float | None:
    permille = getattr(value, "permille", None)
    if permille is not None:
        return round(permille / 10, 2)
    names = {"uncommon": 10.0, "rare": 5.0, "epic": 1.0, "legendary": 0.1}
    kind = value.__class__.__name__.replace("StarGiftAttributeRarity", "").lower()
    return names.get(kind)


def _hex(value: int | None, fallback: str) -> str:
    return f"#{value:06x}" if value is not None else fallback


def _owner(gift: Any, users: dict[int, Any], chats: dict[int, Any]) -> tuple[str, str | None]:
    peer = getattr(gift, "owner_id", None)
    entity = None
    if isinstance(peer, PeerUser):
        entity = users.get(peer.user_id)
    elif isinstance(peer, PeerChannel):
        entity = chats.get(peer.channel_id)
    username = getattr(entity, "username", None)
    name = getattr(gift, "owner_name", None)
    if not name and entity:
        name = " ".join(filter(None, [getattr(entity, "first_name", None), getattr(entity, "last_name", None)]))
        name = name or getattr(entity, "title", None)
    if not name and username:
        name = f"@{username}"
    return name or "Скрытый владелец", f"https://t.me/{username}" if username else None


def _prices(amounts: list[Any] | None) -> tuple[int | None, float | None]:
    stars = ton = None
    for amount in amounts or []:
        if isinstance(amount, StarsAmount):
            stars = int(amount.amount)
        elif isinstance(amount, StarsTonAmount):
            ton = round(amount.amount / 1_000_000_000, 3)
    return stars, ton


def normalize_market_gift(gift: Any, result: Any) -> dict[str, Any]:
    model = backdrop = pattern = None
    for attribute in gift.attributes:
        if isinstance(attribute, StarGiftAttributeModel):
            model = attribute
        elif isinstance(attribute, StarGiftAttributeBackdrop):
            backdrop = attribute
        elif isinstance(attribute, StarGiftAttributePattern):
            pattern = attribute
    if not model or not backdrop or not pattern:
        raise ValueError(f"Gift {gift.slug} has incomplete attributes")
    users = {item.id: item for item in result.users}
    chats = {item.id: item for item in result.chats}
    owner_name, owner_url = _owner(gift, users, chats)
    stars, ton = _prices(getattr(gift, "resell_amount", None))
    usd = None
    if getattr(gift, "value_currency", None) == "USD" and getattr(gift, "value_usd_amount", None) is not None:
        usd = round(gift.value_usd_amount / 100, 2)
    now = datetime.now(UTC).isoformat()
    return {
        "slug": gift.slug.lower(), "collection": gift.title, "number": gift.num,
        "owner_name": owner_name, "owner_url": owner_url,
        "model": model.name, "model_rarity": _rarity(model.rarity),
        "backdrop": backdrop.name, "backdrop_rarity": _rarity(backdrop.rarity),
        "symbol": pattern.name, "symbol_rarity": _rarity(pattern.rarity),
        "image_url": None, "center_color": _hex(backdrop.center_color, "#7868e6"),
        "edge_color": _hex(backdrop.edge_color, "#353080"),
        "issued": gift.availability_issued, "total": gift.availability_total,
        "source_url": f"https://t.me/nft/{gift.slug}",
        "price_stars": stars, "price_ton": ton, "price_usd": usd,
        "price_source": "Telegram resale", "price_updated_at": now,
    }


async def sync_resale_market(db: Database, settings: Settings) -> int:
    if not (settings.telegram_api_id and settings.telegram_api_hash and settings.telegram_session):
        return 0
    count = 0
    run_id = datetime.now(UTC).isoformat()
    collections = CollectionCatalog(db)
    collections.init()
    client = TelegramClient(StringSession(settings.telegram_session), settings.telegram_api_id, settings.telegram_api_hash)
    async with client:
        catalog = await client(GetStarGiftsRequest(hash=0))
        gift_types = list(getattr(catalog, "gifts", []) or [])
        # Index ALL base gift types returned by Telegram, including those without resale.
        for base in gift_types:
            title = str(getattr(base, "title", None) or "").strip()
            collections.upsert_official(int(base.id), title)
        print(f"Gift catalog: {len(gift_types)} official types", flush=True)

        # Fetch a bounded number of original sticker animations each cycle.
        # The catalog remains responsive while the rest are filled in over time.
        media_attempts = 0
        for base in gift_types:
            if media_attempts >= 30:
                break
            key = collections.upsert_official(
                int(base.id), str(getattr(base, "title", None) or "")
            )
            if not collections.needs_media(key):
                continue
            sticker = getattr(base, "sticker", None)
            if not sticker:
                continue
            media_attempts += 1
            try:
                mime = str(getattr(sticker, "mime_type", "") or "")
                if mime not in ("application/x-tgsticker", "video/webm", "image/webp", "image/png"):
                    continue
                payload = await client.download_media(sticker, file=bytes)
                if isinstance(payload, bytes):
                    collections.record_media(key, payload, mime)
            except Exception as exc:
                print(f"Gift catalog media {key}: {type(exc).__name__}", flush=True)

        for base in gift_types:
            if not getattr(base, "availability_resale", None):
                continue
            offset = ""
            while True:
                page = await client(GetResaleStarGiftsRequest(
                    gift_id=base.id, offset=offset, limit=100, sort_by_price=True,
                ))
                for gift in page.gifts:
                    try:
                        normalized = normalize_market_gift(gift, page)
                        normalized["is_listed"] = 1
                        normalized["market_seen"] = run_id
                        db.upsert_data(normalized)
                        count += 1
                    except ValueError:
                        continue
                offset = getattr(page, "next_offset", None) or ""
                if not offset:
                    break
    db.mark_unlisted_after_sync(run_id)
    collections.ensure_observed()
    print(f"Marketplace synced: {count} listed NFTs", flush=True)
    return count


async def sync_loop(db: Database, settings: Settings) -> None:
    while True:
        try:
            await sync_resale_market(db, settings)
        except Exception as exc:
            print(f"Resale sync failed: {exc}")
        await asyncio.sleep(max(settings.resale_sync_minutes, 5) * 60)


async def _main() -> None:
    settings = get_settings()
    db = Database(settings.database_path)
    db.init(settings.allow_demo_data)
    count = await sync_resale_market(db, settings)
    print(f"Indexed {count} resale gifts")


if __name__ == "__main__":
    asyncio.run(_main())

