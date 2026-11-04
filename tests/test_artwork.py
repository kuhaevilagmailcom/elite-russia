import asyncio

import httpx
import pytest

from app.artwork import (
    ArtworkUnavailable, content_type, fetch_artwork, get_artwork,
    telegram_preview, valid_media_url,
)
from app import main
from fastapi.testclient import TestClient


JPG = b"\xff\xd8\xff\xe0" + b"JPEG test content"
WEBP = b"RIFF\x08\x00\x00\x00WEBP" + b"test"
GIF_HTML = '<meta property="og:image" content="https://cdn4.telesco.pe/file/gift.jpg">'


def test_safe_sources_and_signatures():
    assert content_type(JPG) == "image/jpeg"
    assert content_type(WEBP) == "image/webp"
    assert content_type(b"<html>blocked</html>") is None
    assert valid_media_url("https://cdn4.telesco.pe/file/test.jpg")
    assert not valid_media_url("http://127.0.0.1/a")
    assert not valid_media_url("https://evil.telesco.pe.example.org/test")
    assert not valid_media_url("https://nft.fragment.com.evil.org/a")
    assert telegram_preview(GIF_HTML) == "https://cdn4.telesco.pe/file/gift.jpg"
    assert telegram_preview('<meta property="og:image" content="https://evil.com/a.jpg">') is None


def test_fragment_jpg_is_used_when_available():
    requested = []

    def handler(request):
        requested.append(str(request.url))
        return httpx.Response(200, content=JPG, headers={"content-type": "image/jpeg"})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await fetch_artwork(client, "chillflame-1012")

    result = asyncio.run(run())
    assert result.content == JPG
    assert result.mime == "image/jpeg"
    assert requested == ["https://nft.fragment.com/gift/chillflame-1012.medium.jpg"]


def test_fallback_to_telegram_og_image():
    requested = []

    def handler(request):
        requested.append(str(request.url))
        if request.url.host == "nft.fragment.com":
            return httpx.Response(404)
        if request.url.host == "t.me":
            return httpx.Response(200, text=GIF_HTML)
        return httpx.Response(200, content=WEBP)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await fetch_artwork(client, "chillflame-1140")

    result = asyncio.run(run())
    assert result.mime == "image/webp"
    assert requested[-1] == "https://cdn4.telesco.pe/file/gift.jpg"


def test_broken_gift_has_no_fake_diamond():
    def handler(_):
        return httpx.Response(404)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await fetch_artwork(client, "chillflame-1012")

    with pytest.raises(ArtworkUnavailable):
        asyncio.run(run())


def test_server_build_metadata():
    with TestClient(main.app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["build"] == "media-proxy-v5"
        index = client.get("/")
        assert index.headers["cache-control"].startswith("no-store")
        assert b"app.js?v=5" in index.content
