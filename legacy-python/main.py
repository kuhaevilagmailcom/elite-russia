"""Bothost entrypoint: start FastAPI and the Telegram bot in one process."""
import os

import uvicorn

# Import explicitly so startup failures produce the real Python traceback,
# rather than Uvicorn's generic "Could not import module app.main".
from app.main import app


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8000")),
        proxy_headers=True,
    )
