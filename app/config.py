from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    bot_token: str = ""
    public_url: str = "https://bot-1790259314-9532-furadev.bothost.tech"
    database_path: str = "data/gifts.db"
    admin_ids: str = ""
    allow_demo_data: bool = True
    emoji_gift_id: str = ""
    emoji_owner_id: str = ""
    emoji_model_id: str = ""
    emoji_price_id: str = ""
    telegram_api_id: int = 0
    telegram_api_hash: str = ""
    telegram_session: str = ""
    resale_sync_minutes: int = 15

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def webapp_url(self) -> str:
        return self.public_url.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()

