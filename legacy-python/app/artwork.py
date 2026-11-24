"""Fetch a real Telegram collectible thumbnail, cache it, never invent artwork."""
from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup


log = logging.getLogger(__name__)
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*-\d+$", re.I)
ALLOWED_HOSTS = ("nft.fragment.com", "t.me", "telegram.me", "telesco.pe",
                 "telegram.org", "telegram-cdn.org")
MAX_IMAGE_BYTES = 4_000_000
MAX_HTML_BYTES = 512_000
_lock = asyncio.Semaphore(5)
_failures: dict[str, float] = {}


class ArtworkUnavailable(Exception):
    pass


@dataclass(frozen=True)
class Artwork:
    content: bytes
    mime: str


def content_type(payload: bytes) -> str | None:
    if payload.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if payload.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if payload.startswith(b"RIFF") and payload[8:12] == b"WEBP":
        return "image/webp"
    return None


def valid_media_url(value: str) -> bool:
    try:
        uri = urlparse(value)
        host = (uri.hostname or "").lower()
        return (uri.scheme == "https" and uri.username is None and uri.password is None
                and uri.port in (None, 443)
                and any(host == domain or host.endswith("." + domain)
                        for domain in ALLOWED_HOSTS))
    except ValueError:
        return False


def telegram_preview(html: str) -> str | None:
    meta = BeautifulSoup(html, "html.parser").select_one('meta[property="og:image"][content]')
    if not meta:
        return None
    value = str(meta.get("content", ""))
    if value.startswith("//"):
        value = "https:" + value
    return value if valid_media_url(value) else None


async def retrieve(client: httpx.AsyncClient, url: str, max_bytes: int) -> bytes:
    """Never follow arbitrary redirect hosts or download unbounded responses."""
    for _ in range(4):
        if not valid_media_url(url):
            raise ArtworkUnavailable("Недопустимый источник изображения")
        async with client.stream("GET", url, follow_redirects=False) as response:
            if response.status_code in (301, 302, 303, 307, 308):
                redirect = response.headers.get("location", "")
                url = urljoin(url, redirect)
                continue
            response.raise_for_status()
            length = response.headers.get("content-length")
            if length and length.isdigit() and int(length) > max_bytes:
                raise ArtworkUnavailable("Изображение слишком большое")
            chunks = []
            size = 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > max_bytes:
                    raise ArtworkUnavailable("Превышен лимит изображения")
                chunks.append(chunk)
            return b"".join(chunks)
    raise ArtworkUnavailable("Слишком много переадресаций")


async def fetch_artwork(client: httpx.AsyncClient, slug: str) -> Artwork:
    """Try Fragment for this slug, then Telegram's actual OG preview."""
    for suffix in ("medium.jpg", "webp", "small.jpg"):
        try:
            payload = await retrieve(
                client, f"https://nft.fragment.com/gift/{slug}.{suffix}", MAX_IMAGE_BYTES
            )
            kind = content_type(payload)
            if kind:
                return Artwork(payload, kind)
        except (ArtworkUnavailable, httpx.HTTPError):
            continue

    try:
        html = await retrieve(client, f"https://t.me/nft/{slug}", MAX_HTML_BYTES)
        source = telegram_preview(html.decode("utf-8", errors="replace"))
        if source:
            payload = await retrieve(client, source, MAX_IMAGE_BYTES)
            kind = content_type(payload)
            if kind:
                return Artwork(payload, kind)
    except (ArtworkUnavailable, httpx.HTTPError):
        pass
    raise ArtworkUnavailable("Изображение недоступно у Telegram и Fragment")


async def get_artwork(slug: str, database_path: str) -> Artwork:
    slug = slug.lower()
    if not SLUG_RE.fullmatch(slug):
        raise ArtworkUnavailable("Неверный номер подарка")
    cache_dir = Path(database_path).parent / "artworks"

    def cached() -> Artwork | None:
        for ext, mime in (("jpg", "image/jpeg"), ("webp", "image/webp"), ("png", "image/png")):
            path = cache_dir / f"{slug}.{ext}"
            try:
                if path.exists():
                    data = path.read_bytes()
                    if content_type(data) == mime:
                        return Artwork(data, mime)
            except OSError:
                continue
        return None

    previous = cached()
    if previous:
        return previous
    if _failures.get(slug, 0) > time.monotonic():
        raise ArtworkUnavailable("Изображение временно недоступно")

    async with _lock:
        previous = cached()
        if previous:
            return previous
        if _failures.get(slug, 0) > time.monotonic():
            raise ArtworkUnavailable("Изображение временно недоступно")
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(12.0, connect=5.0),
                headers={"User-Agent": "Mozilla/5.0 (compatible; LIMGifts/2.2)"}
            ) as client:
                artwork = await fetch_artwork(client, slug)
        except (httpx.HTTPError, ArtworkUnavailable) as exc:
            _failures[slug] = time.monotonic() + 75
            log.warning("Cannot load NFT artwork %s: %s", slug, exc)
            raise ArtworkUnavailable("Превью подарка недоступно") from exc

        try:
            cache_dir.mkdir(parents=True, exist_ok=True)
            suffix = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[artwork.mime]
            (cache_dir / f"{slug}.{suffix}").write_bytes(artwork.content)
        except OSError:
            pass
        _failures.pop(slug, None)
        return artwork
