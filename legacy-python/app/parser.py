from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup


GIFT_URL_RE = re.compile(
    r"(?:https?://)?(?:t\.me|telegram\.me)/(?:nft/)?(?P<slug>[a-z0-9][a-z0-9_-]*-\d+)",
    re.IGNORECASE,
)


class GiftParseError(ValueError):
    pass


@dataclass(slots=True)
class ParsedGift:
    slug: str
    collection: str
    number: int
    owner_name: str
    owner_url: str | None
    model: str
    model_rarity: float | None
    backdrop: str
    backdrop_rarity: float | None
    symbol: str
    symbol_rarity: float | None
    image_url: str | None
    center_color: str
    edge_color: str
    issued: int | None
    total: int | None
    source_url: str


def normalize_slug(value: str) -> str:
    value = value.strip()
    match = GIFT_URL_RE.search(value)
    if match:
        return match.group("slug").lower()
    if re.fullmatch(r"[a-z0-9][a-z0-9_-]*-\d+", value, re.I):
        return value.lower()
    raise GiftParseError("Нужна ссылка вида t.me/nft/recordplayer-25016")


def _name_and_rarity(value: str) -> tuple[str, float | None]:
    value = " ".join(value.split())
    match = re.match(r"^(.*?)(?:\s+([0-9]+(?:\.[0-9]+)?)%)?$", value)
    if not match:
        return value, None
    return match.group(1).strip(), float(match.group(2)) if match.group(2) else None


def _rgb(value: str | None, fallback: str) -> str:
    if not value:
        return fallback
    value = value.strip()
    if re.fullmatch(r"#[0-9a-f]{6}", value, re.I):
        return value.lower()
    return fallback


def parse_gift_html(html: str, slug: str) -> ParsedGift:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.select_one("meta[property='og:title']")
    title_value = title.get("content", "") if title else ""
    title_match = re.match(r"(.+?)\s+#(\d+)$", title_value.strip())
    slug_match = re.match(r"(.+)-(\d+)$", slug)
    if not title_match or not slug_match:
        raise GiftParseError("Telegram не вернул карточку подарка")

    rows: dict[str, tuple[str, object]] = {}
    for row in soup.select(".tgme_gift_table tr"):
        th, td = row.select_one("th"), row.select_one("td")
        if th and td:
            rows[th.get_text(" ", strip=True).lower()] = (td.get_text(" ", strip=True), td)
    required = {"owner", "model", "backdrop", "symbol"}
    if not required.issubset(rows):
        raise GiftParseError("В карточке не хватает атрибутов подарка")

    model, model_rarity = _name_and_rarity(rows["model"][0])
    backdrop, backdrop_rarity = _name_and_rarity(rows["backdrop"][0])
    symbol, symbol_rarity = _name_and_rarity(rows["symbol"][0])
    owner_td = rows["owner"][1]
    owner_link = owner_td.select_one("a")
    owner_url = owner_link.get("href") if owner_link else None
    if owner_url and owner_url.startswith("//"):
        owner_url = "https:" + owner_url

    issued = total = None
    if "quantity" in rows:
        numbers = re.findall(r"[\d\s\xa0]+", rows["quantity"][0])
        parsed = [int(re.sub(r"\D", "", item)) for item in numbers if re.sub(r"\D", "", item)]
        if len(parsed) >= 2:
            issued, total = parsed[:2]

    image = soup.select_one("meta[property='og:image']")
    gradient = soup.select_one("#giftGradient")
    colors = [node.get("stop-color") for node in gradient.select("stop")] if gradient else []
    return ParsedGift(
        slug=slug,
        collection=title_match.group(1).strip(),
        number=int(title_match.group(2)),
        owner_name=rows["owner"][0],
        owner_url=owner_url,
        model=model,
        model_rarity=model_rarity,
        backdrop=backdrop,
        backdrop_rarity=backdrop_rarity,
        symbol=symbol,
        symbol_rarity=symbol_rarity,
        image_url=image.get("content") if image else None,
        center_color=_rgb(colors[0] if colors else None, "#7868e6"),
        edge_color=_rgb(colors[-1] if colors else None, "#353080"),
        issued=issued,
        total=total,
        source_url=f"https://t.me/nft/{slug}",
    )


async def fetch_gift(value: str) -> ParsedGift:
    slug = normalize_slug(value)
    url = f"https://t.me/nft/{slug}"
    headers = {"User-Agent": "LimuzinovScope/1.0 (+Telegram collectible indexer)"}
    async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=headers) as client:
        response = await client.get(url)
    if response.status_code == 404:
        raise GiftParseError("Подарок не найден")
    response.raise_for_status()
    return parse_gift_html(response.text, slug)

