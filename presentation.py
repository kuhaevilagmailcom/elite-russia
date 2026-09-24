"""Presentation helpers for DEZ REMKA Telegram bot."""
from html import escape


def h(value):
    return escape(str(value), quote=False)


def money(value):
    if value is None:
        return "индивидуально"
    return f"{int(value):,} ₽".replace(",", " ")


def short_service(name):
    aliases = {
        "Постельные клопы": "Клопы",
        "Домовые муравьи": "Муравьи",
        "Мухи внутри помещений": "Мухи",
        "Комары внутри помещений": "Комары",
    }
    return aliases.get(name, name)


def price_lines(services):
    lines = []
    for service in services:
        prices = service.get("area_prices")
        if prices:
            lines.append(
                f"<b>{h(short_service(service['name']))}</b>\n"
                f"до 40 м² — {money(prices[0])} · до 60 м² — {money(prices[1])}\n"
                f"до 100 м² — {money(prices[2])} · до 150 м² — {money(prices[3])}"
            )
    return lines
