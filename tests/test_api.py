from fastapi.testclient import TestClient

from app.main import app


def test_health_and_catalog():
    with TestClient(app) as client:
        assert client.get("/api/health").json()["status"] == "ok"
        response = client.get("/api/gifts?q=Ghost")
        assert response.status_code == 200
        assert response.json()["items"][0]["symbol"] == "Ghost"

