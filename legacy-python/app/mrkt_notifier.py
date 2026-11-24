"""Read-only MRKT giveaway feed and durable Telegram notification queue."""
from __future__ import annotations

import json
import logging
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from html import escape
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

LOG = logging.getLogger(__name__)
MRKT_API = "https://api.tgmrkt.io"
MRKT_APP = "https://t.me/mrkt/app"
NFT_SLUG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{1,100}-\d{1,12}$")
GIVEAWAY_ID = re.compile(r"^[A-Za-z0-9_-]{4,150}$")


def as_text(value: Any, limit: int = 130) -> str:
    return str(value or "").strip()[:limit]


def nft_url(raw: dict) -> str | None:
    gift = raw.get("previewGift") or (raw.get("gifts") or [{}])[0] or {}
    if not isinstance(gift, dict):
        gift = {}
    for value in (gift.get("nftUrl"), gift.get("telegramUrl"), raw.get("nftUrl"), raw.get("giftUrl")):
        try:
            u = urlparse(str(value))
            if u.scheme == "https" and u.hostname in {"t.me", "www.t.me", "telegram.me"}:
                parts = u.path.strip("/").split("/")
                if len(parts) == 2 and parts[0] == "nft" and NFT_SLUG.fullmatch(parts[1]):
                    return f"https://t.me/nft/{parts[1]}"
        except (TypeError, ValueError):
            pass
    for value in (gift.get("slug"), gift.get("uniqueSlug"), raw.get("nftSlug")):
        slug = as_text(value)
        if NFT_SLUG.fullmatch(slug):
            return f"https://t.me/nft/{slug}"
    return None


def normalize(raw: dict, giveaway_type: str) -> dict | None:
    if not isinstance(raw, dict):
        return None
    identifier = as_text(raw.get("id") or raw.get("giveawayId"), 150)
    if not GIVEAWAY_ID.fullmatch(identifier):
        return None
    gift = raw.get("previewGift") or (raw.get("gifts") or [{}])[0] or {}
    if not isinstance(gift, dict):
        gift = {}
    title = as_text(gift.get("title") or gift.get("name") or gift.get("collectionName") or raw.get("title") or "Подарок Telegram")
    if not title:
        title = "Подарок Telegram"
    creator = raw.get("creator") or raw.get("owner") or raw.get("createdBy") or {}
    if not isinstance(creator, dict):
        creator = {}
    organizer = as_text(
        creator.get("username") or creator.get("name") or creator.get("title")
        or raw.get("creatorUsername") or raw.get("ownerUsername") or "не указан",
        80,
    ).removeprefix("@")
    chans = raw.get("chanels") or raw.get("channels") or []
    channels = []
    if isinstance(chans, list):
        for c in chans[:12]:
            name = c if isinstance(c, str) else c.get("username") if isinstance(c, dict) else None
            name = as_text(name, 35).removeprefix("@")
            if re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{4,31}", name):
                channels.append(name)
    price_raw = raw.get("ticketPriceNanoTons")
    try:
        price = float(price_raw) / 1_000_000_000 if price_raw is not None else None
        if price is not None and (price < 0 or price > 10**9):
            price = None
    except (TypeError, ValueError, OverflowError):
        price = None

    def safe_count(x):
        try:
            return max(0, int(x or 0))
        except (TypeError, ValueError, OverflowError):
            return 0

    return {
        "key": f"{giveaway_type.lower()}:{identifier}", "id": identifier, "type": giveaway_type,
        "title": title, "price_ton": price,
        "participants": safe_count(raw.get("participantsCount")),
        "tickets": safe_count(raw.get("totalTickets")),
        "ends": as_text(raw.get("endAt") or raw.get("finishAt"), 50),
        "channels": channels, "organizer": organizer, "nft": nft_url(raw), "url": MRKT_APP,
    }


def format_giveaway(item: dict) -> str:
    paid = item["type"] == "Paid"
    price = "не указана" if item["price_ton"] is None else f'{item["price_ton"]:g} TON'
    ends = item.get("ends") or "не указано"
    channel_names = ", ".join("@" + x for x in item.get("channels", [])) or "не указаны"
    organizer = item.get("organizer") or "не указан"
    if organizer != "не указан" and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{4,31}", organizer):
        organizer = "@" + organizer
    lines = [
        f'{"💎 ПЛАТНЫЙ" if paid else "🎁 БЕСПЛАТНЫЙ"} РОЗЫГРЫШ MRKT',
        f'<b>{escape(item["title"])}</b>', "",
        f'🎟 Билет: <b>{escape(price)}</b>',
        f'👥 Участников: <b>{item["participants"]}</b>',
        f'🎫 Всего билетов: <b>{item["tickets"]}</b>',
        f'⏰ Завершение: {escape(ends)}',
        f'👤 Организатор: {escape(organizer)}',
        f'📢 Каналы: {escape(channel_names)}',
    ]
    return "\n".join(lines)


class MRKTFeed:
    def __init__(self, token: str = "", auth_mode: str = "auto", pages: int = 3):
        self.token = token.strip()
        self.auth_mode = auth_mode if auth_mode in {"auto", "raw", "bearer"} else "auto"
        self.pages = min(5, max(1, pages))

    async def fetch_all(self) -> list[dict]:
        # Retry only read-only GETs with Bearer if a raw token was rejected.
        mode = "bearer" if self.auth_mode == "bearer" else "raw"
        try:
            return await self._fetch_with_mode(mode)
        except RuntimeError as exc:
            if self.token and self.auth_mode == "auto" and ("HTTP 401" in str(exc) or "HTTP 403" in str(exc)):
                return await self._fetch_with_mode("bearer")
            raise

    async def _fetch_with_mode(self, mode: str) -> list[dict]:
        # Only reads. This notifier never purchases tickets or joins channels.
        headers = {"Accept": "application/json", "Origin": "https://cdn.tgmrkt.io", "Referer": "https://cdn.tgmrkt.io/"}
        if self.token:
            if mode == "bearer":
                headers["Authorization"] = "Bearer " + self.token.removeprefix("Bearer ")
            else:
                headers["Authorization"] = self.token
        async with httpx.AsyncClient(timeout=20, headers=headers, follow_redirects=False) as client:
            found: list[dict] = []
            for kind in ("Free", "Paid"):
                cursor = ""
                for _ in range(self.pages):
                    r = await client.get(f"{MRKT_API}/api/v1/giveaways", params={
                        "count": 20, "cursor": cursor, "type": kind,
                        "isActive": "true", "ordering": "EndingTimeWithoutBadge",
                    })
                    if r.status_code in (401, 403):
                        raise RuntimeError(f"MRKT API HTTP {r.status_code}: авторизация или доступ запрещены. Проверь MRKT_API_TOKEN и доступ сервера.")
                    if r.status_code == 404:
                        raise RuntimeError('MRKT API HTTP 404: giveaway endpoint unavailable; confirm the supported read-only API route with MRKT support. No successful scan recorded.')
                    r.raise_for_status()
                    data = r.json()
                    if isinstance(data, list):
                        items, cursor = data, ""
                    elif isinstance(data, dict):
                        items = data.get("items", data.get("giveaways"))
                        cursor = data.get("nextCursor") or ""
                    else:
                        raise RuntimeError("MRKT вернул неожиданный формат списка розыгрышей")
                    if not isinstance(items, list):
                        raise RuntimeError("MRKT изменил формат API; список розыгрышей не распознан")
                    for raw in items:
                        record = normalize(raw, kind)
                        if record:
                            found.append(record)
                    if not cursor or not items:
                        break
            return found


class BroadcastStore:
    def __init__(self, filename: str):
        self.path = Path(filename)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS mrkt_meta (
                    key TEXT PRIMARY KEY, value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS mrkt_subscribers (
                    chat_id INTEGER PRIMARY KEY, active INTEGER NOT NULL DEFAULT 1,
                    joined_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS mrkt_giveaways (
                    key TEXT PRIMARY KEY, content TEXT NOT NULL, first_seen_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS mrkt_delivery (
                    chat_id INTEGER NOT NULL, giveaway_key TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
                    next_attempt TEXT NOT NULL DEFAULT '',
                    PRIMARY KEY(chat_id, giveaway_key)
                );
                CREATE INDEX IF NOT EXISTS mrkt_delivery_pending ON mrkt_delivery(status,next_attempt);
            """)

    def connect(self):
        db = sqlite3.connect(str(self.path), timeout=15)
        db.row_factory = sqlite3.Row
        return db

    def subscribe(self, chat_id: int) -> None:
        with self.connect() as db:
            db.execute(
                "INSERT INTO mrkt_subscribers(chat_id,active,joined_at) VALUES(?,1,?) "
                "ON CONFLICT(chat_id) DO UPDATE SET active=1,joined_at=excluded.joined_at",
                (chat_id, datetime.now(timezone.utc).isoformat()))

    def unsubscribe(self, chat_id: int) -> None:
        with self.connect() as db:
            db.execute("UPDATE mrkt_subscribers SET active=0 WHERE chat_id=?", (chat_id,))
            db.execute("DELETE FROM mrkt_delivery WHERE chat_id=? AND status='pending'", (chat_id,))

    def is_active(self, chat_id: int) -> bool:
        with self.connect() as db:
            return db.execute("SELECT 1 FROM mrkt_subscribers WHERE chat_id=? AND active=1", (chat_id,)).fetchone() is not None

    def count_subscribers(self) -> int:
        with self.connect() as db:
            return db.execute("SELECT COUNT(*) FROM mrkt_subscribers WHERE active=1").fetchone()[0]

    def insert_feed(self, items: list[dict], notify_existing: bool = False, initial_limit: int = 5) -> int:
        """Persist listings and optionally notify subscribers about the first active batch."""
        now = datetime.now(timezone.utc).isoformat()
        with self.connect() as db:
            baseline = db.execute("SELECT 1 FROM mrkt_meta WHERE key='baseline'").fetchone() is None
            inserted = 0
            initial_keys: list[str] = []
            for item in items:
                payload = json.dumps(item, ensure_ascii=False, separators=(",", ":"))
                cur = db.execute("INSERT OR IGNORE INTO mrkt_giveaways(key,content,first_seen_at) VALUES(?,?,?)", (item["key"], payload, now))
                if cur.rowcount == 1:
                    inserted += 1
                    if baseline and notify_existing and len(initial_keys) < max(1, min(20, initial_limit)):
                        initial_keys.append(item["key"])
                    if not baseline:
                        db.execute(
                            "INSERT OR IGNORE INTO mrkt_delivery(chat_id,giveaway_key) "
                            "SELECT chat_id, ? FROM mrkt_subscribers WHERE active=1",
                            (item["key"],))
                else:
                    db.execute("UPDATE mrkt_giveaways SET content=? WHERE key=?", (payload, item["key"]))
            if baseline and notify_existing:
                for key in initial_keys:
                    db.execute(
                        "INSERT OR IGNORE INTO mrkt_delivery(chat_id,giveaway_key) "
                        "SELECT chat_id, ? FROM mrkt_subscribers WHERE active=1",
                        (key,),
                    )
            db.execute("INSERT OR IGNORE INTO mrkt_meta(key,value) VALUES('baseline',?)", (now,))
            return inserted

    def pending(self, limit: int = 50) -> list[tuple[int, dict]]:
        now = datetime.now(timezone.utc).isoformat()
        with self.connect() as db:
            rows = db.execute("""
                SELECT d.chat_id, g.content FROM mrkt_delivery d
                JOIN mrkt_subscribers s ON s.chat_id=d.chat_id AND s.active=1
                JOIN mrkt_giveaways g ON g.key=d.giveaway_key
                WHERE d.status='pending' AND d.next_attempt<=?
                ORDER BY g.first_seen_at, d.chat_id LIMIT ?
            """, (now, limit)).fetchall()
        return [(r["chat_id"], json.loads(r["content"])) for r in rows]

    def mark_delivered(self, chat_id: int, key: str) -> None:
        with self.connect() as db:
            db.execute("UPDATE mrkt_delivery SET status='sent' WHERE chat_id=? AND giveaway_key=?", (chat_id, key))

    def retry(self, chat_id: int, key: str, seconds: int = 60) -> None:
        next_try = (datetime.now(timezone.utc) + timedelta(seconds=max(15, seconds))).isoformat()
        with self.connect() as db:
            db.execute("UPDATE mrkt_delivery SET attempts=attempts+1,next_attempt=? WHERE chat_id=? AND giveaway_key=?", (next_try, chat_id, key))

    def latest(self, count: int = 5) -> list[dict]:
        with self.connect() as db:
            rows = db.execute("SELECT content FROM mrkt_giveaways ORDER BY first_seen_at DESC LIMIT ?", (count,)).fetchall()
        return [json.loads(r["content"]) for r in rows]
