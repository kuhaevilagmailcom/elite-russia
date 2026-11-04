"""Extract genuine Telegram TGS model animations for the Mini App.

Only a Telegram-hosted TGS URL found on the public gift page is fetched.
The untrusted slug cannot select another host or a local path.
"""
from __future__ import annotations

import asyncio
import json
import re
import zlib
from pathlib import Path
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup


SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*-\\d+$", re.I)
_ALLOWED_HOSTS = ("telegram.org", "telesco.pe", "telegram-cdn.org", "t.me")
_lock = asyncio.Semaphore(5)


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
        parsed.scheme != "https"
        or parsed.username or parsed.password
        or not any(hostname == suffix or hostname.endswith("." + suffix) for suffix in _ALLOWED_HOSTS)
    ):
        raise AnimationUnavailable("Источник анимации не поддерживается")
    return url


def decode_tgs(payload: bytes) -> dict:
    if len(payload) > 2_000_000:
        raise AnimationUnavailable("Файл анимации слишком большой")
    try:
        decompressor = zlib.decompressobj(16 + zlib.MAX_WBITS)
        raw = decompressor.decompress(payload, 4_000_001)
        if len(raw) > 4_000_000 or not decompressor.eof:
            raise AnimationUnavailable("Некорректный TGS-файл")
        animation = json.loads(raw)
        if not isinstance(animation, dict) or not isinstance(animation.get("layers"), list):
            raise AnimationUnavailable("Telegram вернул неизвестный формат анимации")
        return animation
    except (ValueError, zlib.error, UnicodeError) as exc:
        raise AnimationUnavailable("Не удалось прочитать анимацию") from exc


async def get_gift_animation(slug: str, database_path: str) -> dict:
    slug = slug.lower()
    if not SLUG_RE.fullmatch(slug):
        raise AnimationUnavailable("Некорректная ссылка на подарок")
    cache = Path(database_path).parent / "animations" / (slug + ".json")
    if cache.exists():
        try:
            return json.loads(cache.read_text("utf-8"))
        except (OSError, ValueError):
            pass
    async with _lock:
        if cache.exists():
            try:
                return json.loads(cache.read_text("utf-8"))
            except (OSError, ValueError):
                pass
        try:
            async with httpx.AsyncClient(
                timeout=14, follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (compatible; LimGifts/2.0)"},
            ) as client:
                html = await client.get(f"https://t.me/nft/{slug}")
                html.raise_for_status()
                source_url = find_tgs_url(html.text)
                tgs = await client.get(source_url)
                tgs.raise_for_status()
                animation = decode_tgs(tgs.content)
        except AnimationUnavailable:
            raise
        except httpx.HTTPError as exc:
            raise AnimationUnavailable("Анимация временно недоступна у Telegram") from exc
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(animation, separators=(",", ":")), encoding="utf-8")
        return animation
