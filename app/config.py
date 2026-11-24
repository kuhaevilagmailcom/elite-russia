from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    bot_token: str = ""
    public_url: str = "https://bot-1790259314-9532-furadev.bothost.tech"
    database_path: str = "data/gifts.db"
    admin_ids: str = ""
    allow_demo_data: bool = False
    emoji_gift_id: str = ""
    emoji_owner_id: str = ""
    emoji_model_id: str = ""
    emoji_price_id: str = ""
    telegram_api_id: int = 0
    telegram_api_hash: str = ""
    telegram_session: str = ""
    resale_sync_minutes: int = 15

    # MRKT notifier settings; secrets belong in BotHost environment.
    mrkt_token: str = Field(
        default="",
        validation_alias=AliasChoices("MRKT_API_TOKEN", "MRKT_TOKEN"),
    )
    mrkt_auth_mode: str = "auto"
    mrkt_poll_seconds: int = 120
    mrkt_pages: int = 3
    mrkt_watch_types: str = "both"
    mrkt_max_paid_ton: float = 0.0
    mrkt_notify_existing: bool = True
    mrkt_initial_limit: int = 5

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    @property
    def webapp_url(self) -> str:
        return self.public_url.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
