from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator

from app.parser import ParsedGift


SCHEMA = """
CREATE TABLE IF NOT EXISTS gifts (
  slug TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  number INTEGER NOT NULL,
  owner_name TEXT NOT NULL,
  owner_url TEXT,
  model TEXT NOT NULL,
  model_rarity REAL,
  backdrop TEXT NOT NULL,
  backdrop_rarity REAL,
  symbol TEXT NOT NULL,
  symbol_rarity REAL,
  image_url TEXT,
  center_color TEXT NOT NULL DEFAULT '#7868e6',
  edge_color TEXT NOT NULL DEFAULT '#353080',
  issued INTEGER,
  total INTEGER,
  source_url TEXT NOT NULL,
  price_stars INTEGER,
  price_ton REAL,
  price_usd REAL,
  price_source TEXT,
  price_updated_at TEXT,
  indexed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_gifts_search ON gifts(collection, owner_name, model, backdrop, symbol);
CREATE TABLE IF NOT EXISTS favorites (
  telegram_id INTEGER NOT NULL,
  gift_slug TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (telegram_id, gift_slug),
  FOREIGN KEY (gift_slug) REFERENCES gifts(slug) ON DELETE CASCADE
);
"""


DEMO_GIFTS = [
    {
        "slug": "recordplayer-25016", "collection": "Record Player", "number": 25016,
        "owner_name": "Denis", "model": "Mr. Orange", "model_rarity": 1.5,
        "backdrop": "Celtic Blue", "backdrop_rarity": 1.5, "symbol": "Ghost",
        "symbol_rarity": .5, "center_color": "#45b8ed", "edge_color": "#3886d9",
        "price_stars": 1640, "price_ton": 12.8, "price_usd": 38.4,
        "price_source": "Демо-оценка", "image_url": "https://cdn5.telesco.pe/file/B5kRiCYIFH-Lme3UkFBVK9CjfdWpGPCfxLQZSOWQvhMP8m-7aY2ebO5ORKF2zoywYEop7slGuWDoCckre41-_ZePVO4Xtvv8Zh1hYmq5xr7GmiX8JA80TkJ47RqOHCN5UUux0Cly8ZJza-un8FX4ECRd0USPQM5FRs4IRRqWrbX4W8SZDJU6EiWtLBBc57cS4-1JNDA9306mk_rXldCQslvR2U_jGr6DeQKzBd-Vcu3uyNW4X1IIglKkg9W-MX5vzHI-vg3n9Clc4L-jGw5RJm25PStcvx80fLzX17DteLmNFD05T8ERhQ0HuqTj4YWywCNFNPslRJ7Pp9k7KKpnhA.jpg"
    },
    {
        "slug": "tamagadget-45557", "collection": "Tama Gadget", "number": 45557,
        "owner_name": "ReMaxVon", "model": "Diamond Ton", "model_rarity": .3,
        "backdrop": "Navy Blue", "backdrop_rarity": 1.0, "symbol": "Dice",
        "symbol_rarity": .3, "center_color": "#5867d8", "edge_color": "#222a72",
        "price_stars": 4300, "price_ton": 33.2, "price_usd": 99.6,
        "price_source": "Демо-оценка"
    },
    {
        "slug": "eternalcandle-24347", "collection": "Eternal Candle", "number": 24347,
        "owner_name": "Gift Relayer", "model": "Serenity", "model_rarity": 1.5,
        "backdrop": "Onyx Black", "backdrop_rarity": 1.5, "symbol": "Gift Box",
        "symbol_rarity": .5, "center_color": "#626676", "edge_color": "#20222a",
        "price_stars": 910, "price_ton": 7.1, "price_usd": 21.3,
        "price_source": "Демо-оценка"
    },
    {
        "slug": "valentinebox-2026", "collection": "Valentine Box", "number": 2026,
        "owner_name": "gift is", "model": "Traveler", "model_rarity": 1.0,
        "backdrop": "Aquamarine", "backdrop_rarity": 1.5, "symbol": "Angel",
        "symbol_rarity": .7, "center_color": "#50d8c8", "edge_color": "#187a83",
        "price_stars": 1380, "price_ton": 10.6, "price_usd": 31.8,
        "price_source": "Демо-оценка"
    },
    {
        "slug": "signetring-11012", "collection": "Signet Ring", "number": 11012,
        "owner_name": "ok7777.t.me", "model": "Tony Stark", "model_rarity": 1.0,
        "backdrop": "Strawberry", "backdrop_rarity": 2.0, "symbol": "Lion King",
        "symbol_rarity": 1.0, "center_color": "#ff7f9f", "edge_color": "#a42f58",
        "price_stars": 2240, "price_ton": 17.3, "price_usd": 51.9,
        "price_source": "Демо-оценка"
    },
    {
        "slug": "lovecandle-20154", "collection": "Love Candle", "number": 20154,
        "owner_name": "mii", "model": "Coral Reef", "model_rarity": 3.0,
        "backdrop": "Pure Gold", "backdrop_rarity": 2.0, "symbol": "Rabbit",
        "symbol_rarity": 1.0, "center_color": "#f7cb58", "edge_color": "#b97819",
        "price_stars": 780, "price_ton": 6.0, "price_usd": 18.0,
        "price_source": "Демо-оценка"
    }
]


class Database:
    def __init__(self, path: str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def init(self, demo: bool = True) -> None:
        with self.connect() as conn:
            conn.executescript(SCHEMA)
            if demo and conn.execute("SELECT COUNT(*) FROM gifts").fetchone()[0] == 0:
                for gift in DEMO_GIFTS:
                    self._upsert_dict(conn, gift)

    def _upsert_dict(self, conn: sqlite3.Connection, gift: dict[str, Any]) -> None:
        now = datetime.now(UTC).isoformat()
        complete = {
            "owner_url": None, "image_url": None, "issued": None, "total": None,
            "price_stars": None, "price_ton": None, "price_usd": None,
            "price_source": None, "price_updated_at": now,
            "source_url": f"https://t.me/nft/{gift['slug']}", "indexed_at": now,
            **gift,
        }
        columns = list(complete)
        updates = ", ".join(f"{col}=excluded.{col}" for col in columns if col != "slug")
        conn.execute(
            f"INSERT INTO gifts ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)}) "
            f"ON CONFLICT(slug) DO UPDATE SET {updates}",
            [complete[col] for col in columns],
        )

    def upsert(self, gift: ParsedGift) -> dict[str, Any]:
        with self.connect() as conn:
            existing = conn.execute("SELECT price_stars,price_ton,price_usd,price_source,price_updated_at FROM gifts WHERE slug=?", (gift.slug,)).fetchone()
            data = asdict(gift)
            if existing:
                data.update(dict(existing))
            self._upsert_dict(conn, data)
        return self.get(gift.slug) or data

    def upsert_data(self, gift: dict[str, Any]) -> dict[str, Any]:
        """Store a normalized gift received from an authenticated market provider."""
        with self.connect() as conn:
            self._upsert_dict(conn, gift)
        return self.get(gift["slug"]) or gift

    def get(self, slug: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM gifts WHERE slug=?", (slug,)).fetchone()
        return dict(row) if row else None

    @staticmethod
    def _where(query: str, filters: dict[str, str] | None) -> tuple[str, list[str]]:
        filters = filters or {}
        clauses: list[str] = []
        params: list[str] = []
        normalized = query.strip().removeprefix("#")
        if normalized:
            q = f"%{normalized}%"
            clauses.append(
                "(collection LIKE ? OR owner_name LIKE ? OR model LIKE ? "
                "OR backdrop LIKE ? OR symbol LIKE ? OR slug LIKE ? "
                "OR CAST(number AS TEXT) LIKE ?)"
            )
            params.extend([q] * 7)
        for key in ("collection", "model", "backdrop", "symbol"):
            if filters.get(key):
                clauses.append(f"{key} = ?")
                params.append(filters[key])
        return (" WHERE " + " AND ".join(clauses) if clauses else "", params)

    def search(
        self, query: str = "", filters: dict[str, str] | None = None,
        limit: int = 48, offset: int = 0,
    ) -> list[dict[str, Any]]:
        where, params = self._where(query, filters)
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM gifts" + where
                + " ORDER BY collection COLLATE NOCASE, number LIMIT ? OFFSET ?",
                [*params, max(1, min(limit, 100)), max(0, offset)],
            ).fetchall()
        return [dict(row) for row in rows]

    def count(self, query: str = "", filters: dict[str, str] | None = None) -> int:
        where, params = self._where(query, filters)
        with self.connect() as conn:
            return int(conn.execute("SELECT COUNT(*) FROM gifts" + where, params).fetchone()[0])

    def facets(self) -> dict[str, list[str]]:
        result: dict[str, list[str]] = {}
        with self.connect() as conn:
            for key in ("collection", "model", "backdrop", "symbol"):
                result[key] = [row[0] for row in conn.execute(f"SELECT DISTINCT {key} FROM gifts ORDER BY {key}")]
        return result

    def toggle_favorite(self, telegram_id: int, slug: str) -> bool:
        with self.connect() as conn:
            exists = conn.execute("SELECT 1 FROM favorites WHERE telegram_id=? AND gift_slug=?", (telegram_id, slug)).fetchone()
            if exists:
                conn.execute("DELETE FROM favorites WHERE telegram_id=? AND gift_slug=?", (telegram_id, slug))
                return False
            conn.execute("INSERT INTO favorites VALUES (?,?,?)", (telegram_id, slug, datetime.now(UTC).isoformat()))
            return True

