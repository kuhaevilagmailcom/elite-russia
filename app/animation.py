"""Provide the genuine Lottie animation for a specific Telegram NFT."""
from __future__ import annotations

import asyncio
import json
import re
import zlib
from pathlib import Path
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup


SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*-\d+$", re.I)
_ALLOWED_HOSTS = ("telegram.org", "telesco.pe", "telegram-cdn.org", "t.me")
_lock = asyncio.Semaphore(6)
MAX_JSON = 5_000_000
MAX_TGS = 2_000_000


class AnimationUnavailable(Exception):
    pass


def find_tgs_url(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    source = soup.select_one('source[type="application/x-tgsticker"][src]')
    if not source:
        raise AnimationUnavailable("Telegram не предоставил анимацию этого подарка")
    url = str(source.get("src", "")).strip()
    if url.startswith("//"):
        url = "https:" + url
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    if (
        parsed.scheme != "https" or parsed.username or parsed.password
        or not any(hostname == suffix or hostname.endswith("." + suffix) for suffix in _ALLOWED_HOSTS)
    ):
        raise AnimationUnavailable("Источник анимации не поддерживается")
    return url


def validate_lottie(animation: object) -> dict:
    if (
        not isinstance(animation, dict)
        or not isinstance(animation.get("layers"), list)
        or not isinstance(animation.get("fr"), (int, float))
        or not isinstance(animation.get("w"), (int, float))
        or not isinstance(animation.get("h"), (int, float))
    ):
        raise AnimationUnavailable("Некорректная анимация Lottie")
    return animation


def decode_tgs(payload: bytes) -> dict:
    if len(payload) > MAX_TGS:
        raise AnimationUnavailable("Файл анимации слишком большой")
    try:
        decompressor = zlib.decompressobj(16 + zlib.MAX_WBITS)
        raw = decompressor.decompress(payload, MAX_JSON + 1)
        if len(raw) > MAX_JSON or not decompressor.eof:
            raise AnimationUnavailable("Некорректный TGS-файл")
        return validate_lottie(json.loads(raw))
    except (ValueError, zlib.error, UnicodeError) as exc:
        raise AnimationUnavailable("Не удалось прочитать анимацию") from exc


def decode_lottie_json(payload: bytes) -> dict:
    if len(payload) > MAX_JSON:
        raise AnimationUnavailable("Файл Lottie слишком большой")
    try:
        return validate_lottie(json.loads(payload))
    except (ValueError, UnicodeError) as exc:
        raise AnimationUnavailable("Не удалось прочитать Lottie JSON") from exc


async def download_animation(client: httpx.AsyncClient, slug: str) -> dict:
    """Try the full collectible art on Fragment, then the Telegram model TGS."""
    try:
        response = await client.get(f"https://nft.fragment.com/gift/{slug}.lottie.json")
        response.raise_for_status()
        return decode_lottie_json(response.content)
    except (httpx.HTTPError, AnimationUnavailable):
        pass

    try:
        page = await client.get(f"https://t.me/nft/{slug}")
        page.raise_for_status()
        tgs_url = find_tgs_url(page.text)
        response = await client.get(tgs_url)
        response.raise_for_status()
        return decode_tgs(response.content)
    except (httpx.HTTPError, AnimationUnavailable) as exc:
        raise AnimationUnavailable("Telegram и Fragment не отдали анимацию подарка") from exc


async def get_gift_animation(slug: str, database_path: str) -> dict:
    slug = slug.lower()
    if not SLUG_RE.fullmatch(slug):
        raise AnimationUnavailable("Некорректная ссылка на подарок")
    cache = Path(database_path).parent / "animations" / (slug + ".json")

    def read_cache() -> dict | None:
        try:
            if cache.exists():
                return validate_lottie(json.loads(cache.read_text("utf-8")))
        except (OSError, ValueError, AnimationUnavailable):
            pass
        return None

    cached = read_cache()
    if cached is not None:
        return cached

    async with _lock:
        cached = read_cache()
        if cached is not None:
            return cached
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(8.0, connect=5.0),
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LIMGifts/2.1)"},
        ) as client:
            animation = await download_animation(client, slug)
        try:
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(animation, separators=(",", ":")), encoding="utf-8")
        except OSError:
            pass
        return animation
