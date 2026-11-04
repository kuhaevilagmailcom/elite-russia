import gzip
import json

from app.catalog import CollectionCatalog, key_for_title
from app.db import Database


def gift(collection: str, number: int, listed: bool = False, stamp: str | None = None):
    return {
        "slug": f"{key_for_title(collection)}-{number}",
        "collection": collection, "number": number,
        "owner_name": "Alice", "model": "Blue Thing",
        "backdrop": "Mint", "symbol": "Star",
        "center_color": "#4455aa", "edge_color": "#112266",
        "price_source": "Telegram resale" if listed else None,
        "price_stars": 500 if listed else None,
        "is_listed": int(listed), "market_seen": stamp,
    }


def test_catalog_preserves_existing_instances_and_includes_official_types(tmp_path):
    db = Database(str(tmp_path / "gifts.sqlite3"))
    db.init(False)
    db.upsert_data(gift("Chill Flame", 1012, True))
    db.upsert_data(gift("Chill Flame", 1140, False))
    db.upsert_data(gift("Plush Pepe", 1, False))
    catalog = CollectionCatalog(db)
    catalog.init()
    assert db.count() == 3
    assert db.count(market=True) == 1
    assert catalog.list()["total"] == 2
    assert catalog.list(q="Chill")["items"][0]["indexed_count"] == 2
    assert catalog.list(q="Chill")["items"][0]["market_count"] == 1

    catalog.upsert_official(10001, "Another Gift")
    assert catalog.list()["total"] == 3
    item = catalog.list(q="Another Gift")["items"][0]
    assert item["official"] == 1
    assert item["indexed_count"] == 0
    assert item["sample_slug"] == ""
    assert db.count() == 3
    assert catalog.list(q="Mint")["total"] == 2
    assert catalog.list(filters={"model": "Blue Thing"})["total"] == 2


def test_stale_market_removed_from_market_only(tmp_path):
    db = Database(str(tmp_path / "test.sqlite3"))
    db.init(False)
    db.upsert_data(gift("Chill Flame", 100, True, "old-run"))
    db.upsert_data(gift("Chill Flame", 200, True, "current-run"))
    db.mark_unlisted_after_sync("current-run")
    assert db.count() == 2
    assert db.count(market=True) == 1
    assert db.get("chillflame-100")["is_listed"] == 0


def test_existing_db_adds_market_columns_without_deleting_data(tmp_path):
    import sqlite3
    file = tmp_path / "legacy.sqlite3"
    conn = sqlite3.connect(file)
    conn.execute(
        "CREATE TABLE gifts (slug TEXT PRIMARY KEY,collection TEXT NOT NULL,"
        "number INTEGER NOT NULL,owner_name TEXT NOT NULL,owner_url TEXT,"
        "model TEXT NOT NULL,model_rarity REAL,backdrop TEXT NOT NULL,"
        "backdrop_rarity REAL,symbol TEXT NOT NULL,symbol_rarity REAL,"
        "image_url TEXT,center_color TEXT,edge_color TEXT,issued INTEGER,"
        "total INTEGER,source_url TEXT,price_stars INTEGER,price_ton REAL,"
        "price_usd REAL,price_source TEXT,price_updated_at TEXT,indexed_at TEXT)"
    )
    conn.execute("INSERT INTO gifts (slug,collection,number,owner_name,model,backdrop,symbol,price_source) "
                 "VALUES ('chillflame-1012','Chill Flame',1012,'Alice','Blue','Red','Star','Telegram resale')")
    conn.commit()
    conn.close()
    db = Database(str(file))
    db.init(False)
    assert db.get("chillflame-1012")["is_listed"] == 1
    assert db.count() == 1


def test_collection_sticker_validation(tmp_path):
    db = Database(str(tmp_path / "gifts.sqlite3"))
    db.init(False)
    catalog = CollectionCatalog(db)
    catalog.init()
    key = catalog.upsert_official(10001, "Test Gift")
    tgs = gzip.compress(json.dumps({"v": "5.5", "w": 512, "h": 512,
                                   "fr": 30, "layers": []}).encode())
    assert catalog.record_media(key, tgs, "application/x-tgsticker") == "tgs"
    assert catalog.get_media_path(key)[1] == "tgs"
    assert catalog.needs_media(key) is False
    assert catalog.record_media(key, b"bad", "application/x-tgsticker") is None
    assert catalog.get("../etc") is None


def test_api_separates_collections_market_and_all_known_nfts(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from app import main
    db = Database(str(tmp_path / "test.db"))
    monkeypatch.setattr(main, "db", db)
    monkeypatch.setattr(main, "collections", CollectionCatalog(db))
    with TestClient(main.app) as client:
        db.upsert_data(gift("Chill Flame", 1012, True, "run1"))
        db.upsert_data(gift("Chill Flame", 1140, False))
        main.collections.ensure_observed()
        assert client.get("/api/collections").json()["total"] == 1
        assert client.get("/api/market").json()["total"] == 1
        assert client.get("/api/gifts").json()["total"] == 2
        assert client.get("/api/collections?q=Mint").json()["total"] == 1
        assert client.get("/api/stats").json()["collections"] == 1
        assert client.get("/api/facets").json()["collection"] == ["Chill Flame"]
