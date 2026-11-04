from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.config import get_settings
from app.db import Database
from app.parser import GiftParseError, fetch_gift
from app.animation import AnimationUnavailable, get_gift_animation


settings = get_settings()
db = Database(settings.database_path)


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init(settings.allow_demo_data)
    bot_task = None
    if settings.bot_token:
        from app.bot import run_bot
        bot_task = asyncio.create_task(run_bot(db, settings))
    sync_task = None
    if settings.telegram_api_id and settings.telegram_api_hash and settings.telegram_session:
        from app.resale_sync import sync_loop
        sync_task = asyncio.create_task(sync_loop(db, settings))
    yield
    if bot_task:
        bot_task.cancel()
    if sync_task:
        sync_task.cancel()


app = FastAPI(title="Limuzinov Scope", version="1.0.0", lifespan=lifespan)
static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")


class ImportBody(BaseModel):
    url: str


class FavoriteBody(BaseModel):
    telegram_id: int


@app.get("/")
def index():
    return FileResponse(static_dir / "index.html")


@app.get("/api/health")
def health():
    return {"status": "ok", "bot": bool(settings.bot_token)}


@app.get("/api/gifts")
def list_gifts(
    q: str = "",
    collection: str = "",
    model: str = "",
    backdrop: str = "",
    symbol: str = "",
    limit: int = Query(48, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    filters = {"collection": collection, "model": model, "backdrop": backdrop, "symbol": symbol}
    total = db.count(q, filters)
    items = db.search(q, filters, limit=limit, offset=offset)
    return {
        "items": items,
        "total": total,
        "next_offset": offset + len(items) if offset + len(items) < total else None,
    }


@app.get("/api/gifts/{slug}")
def gift_detail(slug: str):
    gift = db.get(slug.lower())
    if not gift:
        raise HTTPException(404, "Подарок не найден")
    return gift


@app.get("/api/animation/{slug}")
async def gift_animation(slug: str):
    if not db.get(slug.lower()):
        raise HTTPException(404, "Подарок не найден в каталоге")
    try:
        animation = await get_gift_animation(slug, settings.database_path)
    except AnimationUnavailable as exc:
        raise HTTPException(404, str(exc)) from exc
    return JSONResponse(animation, headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/stats")
def stats():
    return {"total": db.count()}


@app.get("/api/facets")
def facets():
    return db.facets()


@app.post("/api/import")
async def import_gift(body: ImportBody):
    try:
        parsed = await fetch_gift(body.url)
    except GiftParseError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, "Telegram временно не отдал карточку") from exc
    return db.upsert(parsed)


@app.post("/api/gifts/{slug}/favorite")
def favorite(slug: str, body: FavoriteBody):
    if not db.get(slug):
        raise HTTPException(404, "Подарок не найден")
    return {"favorite": db.toggle_favorite(body.telegram_id, slug)}

