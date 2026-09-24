"""DEZ REMKA entrypoint. Runtime source is split into text parts for deployment."""
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
_PARTS = sorted((_ROOT / "_runtime").glob("bot_*.part"))
if not _PARTS:
    raise RuntimeError("DEZ REMKA runtime parts are missing")
_SOURCE = b"".join(p.read_bytes() for p in _PARTS).decode("utf-8")
exec(compile(_SOURCE, str(_ROOT / "bot_runtime.py"), "exec"), globals(), globals())
