from aiogram.types import User
from app.bot import start_text


def test_start_uses_telegram_username():
    user = User(id=1, is_bot=False, first_name="Вася", username="limyzinov")
    assert "@limyzinov" in start_text(user)
    assert "MRKT" in start_text(user)


def test_start_escapes_html():
    user = User(id=2, is_bot=False, first_name="Аня & <test>")
    assert "Аня &amp; &lt;test&gt;" in start_text(user)


def test_start_without_user():
    assert "<b>друг</b>" in start_text(None)
