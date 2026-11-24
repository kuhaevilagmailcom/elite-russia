from fastapi.testclient import TestClient

from app import main
from app.db import Database
from app.catalog import CollectionCatalog


def test_health_and_catalog_without_fake_data(tmp_path, monkeypatch):
    fresh_db = Database(str(tmp_path / "gifts.db"))
    monkeypatch.setattr(main, "db", fresh_db)
    monkeypatch.setattr(main, "collections", CollectionCatalog(fresh_db))
    with TestClient(main.app) as client:
        assert client.get("/api/health").json()["status"] == "ok"
        response = client.get("/api/gifts?q=Ghost")
        assert response.status_code == 200
        assert response.json() == {"items": [], "total": 0, "next_offset": None}
        assert client.get("/api/facets").json() == {
            "collection": [], "model": [], "backdrop": [], "symbol": []
        }
