from aiogram.types import User

from app.bot import start_text


def test_start_uses_telegram_username():
    user = User(id=1, is_bot=False, first_name="Вася", username="limyzinov")
    assert start_text(user) == "Салам, <b>@limyzinov</b>, ёпта! Это мой парсер NFT."


def test_start_escapes_html():
    user = User(id=2, is_bot=False, first_name="Аня & <test>")
    assert start_text(user) == "Салам, <b>Аня &amp; &lt;test&gt;</b>, ёпта! Это мой парсер NFT."


def test_start_without_user():
    assert start_text(None) == "Салам, <b>друг</b>, ёпта! Это мой парсер NFT."
