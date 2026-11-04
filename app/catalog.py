"""Separate the Telegram gift-type catalog from individual NFTs on resale.

All indexed collectible instances remain in the existing 'gifts' SQLite table.
The type catalog is a new additive table; no existing NFT records are deleted.
"""
from __future__ import annotations

import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.animation import decode_tgs, AnimationUnavailable
from app.db import Database


CATALOG_SCHEMA = """
CREATE TABLE IF NOT EXISTS gift_collections (
    key TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    gift_id TEXT,
    official INTEGER NOT NULL DEFAULT 0,
    media_kind TEXT,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_gift_collections_title ON gift_collections(title);
"""
KEY_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$", re.I)


def key_for_title(title: str, gift_id: int | str | None = None) -> str:
    normalized = re.sub(r"[^a-z0-9]", "", title.lower())
    return normalized or (f"gift-{gift_id}" if gift_id else "")


class CollectionCatalog:
    def __init__(self, db: Database):
        self.db = db
        self.media_dir = db.path.parent / "collection_media"

    def init(self) -> None:
        with self.db.connect() as conn:
            conn.executescript(CATALOG_SCHEMA)
        self.ensure_observed()

    def ensure_observed(self) -> None:
        """Include gift types learned from imports and the resale index."""
        now = datetime.now(UTC).isoformat()
        with self.db.connect() as conn:
            rows = conn.execute("SELECT DISTINCT collection FROM gifts").fetchall()
            for row in rows:
                title = row["collection"]
                key = key_for_title(title)
                if not key:
                    continue
                conn.execute(
                    "INSERT INTO gift_collections(key,title,updated_at) VALUES(?,?,?) "
                    "ON CONFLICT(key) DO NOTHING",
                    (key, title, now),
                )

    def upsert_official(self, gift_id: int, title: str) -> str:
        clean_title = title.strip() or f"Подарок #{gift_id}"
        key = key_for_title(clean_title, gift_id)
        now = datetime.now(UTC).isoformat()
        with self.db.connect() as conn:
            conn.execute(
                "INSERT INTO gift_collections(key,title,gift_id,official,updated_at) "
                "VALUES(?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET "
                "title=excluded.title,gift_id=excluded.gift_id,"
                "official=1,updated_at=excluded.updated_at",
                (key, clean_title, str(gift_id), 1, now),
            )
        return key

    def record_media(self, key: str, payload: bytes, mime: str) -> str | None:
        if not KEY_RE.fullmatch(key) or not payload or len(payload) > 5_000_000:
            return None
        if mime == "application/x-tgsticker":
            try:
                decode_tgs(payload)
            except (AnimationUnavailable, ValueError):
                return None
            kind = "tgs"
        elif mime == "video/webm" and payload[:4] == b"\x1a\x45\xdf\xa3":
            kind = "webm"
        elif mime == "image/webp" and payload[:4] == b"RIFF" and payload[8:12] == b"WEBP":
            kind = "webp"
        elif mime == "image/png" and payload.startswith(b"\x89PNG\r\n\x1a\n"):
            kind = "png"
        else:
            return None
        self.media_dir.mkdir(parents=True, exist_ok=True)
        (self.media_dir / f"{key}.{kind}").write_bytes(payload)
        with self.db.connect() as conn:
            conn.execute("UPDATE gift_collections SET media_kind=? WHERE key=?", (kind, key))
        return kind

    def needs_media(self, key: str) -> bool:
        with self.db.connect() as conn:
            row = conn.execute(
                "SELECT media_kind FROM gift_collections WHERE key=?", (key,)
            ).fetchone()
        return bool(row and (not row["media_kind"] or
                  not (self.media_dir / f"{key}.{row['media_kind']}").exists()))

    def get(self, key: str) -> dict[str, Any] | None:
        if not KEY_RE.fullmatch(key):
            return None
        with self.db.connect() as conn:
            result = conn.execute(
                "SELECT key,title,gift_id,official,media_kind FROM gift_collections WHERE key=?",
                (key,),
            ).fetchone()
        return dict(result) if result else None

    def get_media_path(self, key: str) -> tuple[Path, str] | None:
        row = self.get(key)
        if not row or not row["media_kind"]:
            return None
        kind = row["media_kind"]
        if kind not in ("tgs", "webm", "webp", "png"):
            return None
        path = self.media_dir / f"{key}.{kind}"
        return (path, kind) if path.is_file() else None

    def _query(
        self, q: str = "", filters: dict[str, str] | None = None,
    ) -> tuple[str, list[str]]:
        filters = filters or {}
        conditions = []
        params: list[str] = []
        if filters.get("collection"):
            conditions.append("c.title=?")
            params.append(filters["collection"])
        like_query = q.strip()
        if like_query:
            search = f"%{like_query}%"
            conditions.append(
                "(c.title LIKE ? OR c.key LIKE ? OR EXISTS "
                "(SELECT 1 FROM gifts gg WHERE gg.collection=c.title AND "
                "(gg.model LIKE ? OR gg.backdrop LIKE ? OR gg.symbol LIKE ? OR "
                "gg.owner_name LIKE ? OR CAST(gg.number AS TEXT) LIKE ?)))"
            )
            params.extend([search] * 7)
        extra_conditions = []
        extra_params = []
        for field in ("model", "backdrop", "symbol"):
            if filters.get(field):
                extra_conditions.append(f"gg.{field}=?")
                extra_params.append(filters[field])
        if extra_conditions:
            conditions.append(
                "EXISTS(SELECT 1 FROM gifts gg WHERE gg.collection=c.title AND "
                + " AND ".join(extra_conditions) + ")"
            )
            params.extend(extra_params)
        return (" WHERE " + " AND ".join(conditions) if conditions else "", params)

    def list(
        self, q: str = "", filters: dict[str, str] | None = None,
        limit: int = 48, offset: int = 0,
    ) -> dict[str, Any]:
        where, params = self._query(q, filters)
        base = (
            "FROM gift_collections c LEFT JOIN ("
            "SELECT LOWER(collection) AS coll, MIN(slug) AS sample_slug,"
            "COUNT(*) AS indexed_count, SUM(CASE WHEN is_listed=1 THEN 1 ELSE 0 END) AS listed_count "
            "FROM gifts GROUP BY LOWER(collection)"
            ") g ON g.coll=LOWER(c.title)"
        )
        with self.db.connect() as conn:
            total = conn.execute("SELECT COUNT(*) " + base + where, params).fetchone()[0]
            rows = conn.execute(
                "SELECT c.key,c.title,c.gift_id,c.official,c.media_kind,"
                "COALESCE(g.sample_slug,'') AS sample_slug,"
                "COALESCE(g.indexed_count,0) AS indexed_count,"
                "COALESCE(g.listed_count,0) AS market_count "
                + base + where + " ORDER BY c.title COLLATE NOCASE LIMIT ? OFFSET ?",
                [*params, min(max(limit, 1), 100), max(offset, 0)],
            ).fetchall()
        items = [dict(row) for row in rows]
        return {
            "items": items,
            "total": total,
            "next_offset": offset + len(items) if offset + len(items) < total else None,
        }
