"""Inline administrator panel and persistent customer message outbox."""
import json

from presentation import h, money

STATUS = {
    "awaiting_payment": "Ожидает оплаты",
    "expired": "Счёт истёк",
    "new": "Новый",
    "accepted": "Принят",
    "rejected": "Отклонён",
}

PAYMENT = {
    "paid": "оплачено",
    "pending": "ожидает оплаты",
    "expired": "ссылка истекла",
    "manual": "без онлайн-оплаты",
    "quote": "нужен расчёт",
    "legacy": "статус оплаты неизвестен",
}


def b(text, data, style=None):
    item = {"text": text, "callback_data": data}
    if style:
        item["style"] = style
    return item


class AdminPanel:
    def __init__(self, bot):
        self.bot, self.db, self.api = bot, bot.db, bot.api
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS admin_state(chat INTEGER PRIMARY KEY, data TEXT);
            CREATE TABLE IF NOT EXISTS outbox(
                id INTEGER PRIMARY KEY,
                booking INTEGER,
                chat INTEGER,
                text TEXT,
                sent INTEGER DEFAULT 0
            );
        """)
        self.db.commit()

    def save(self, data):
        if not self.bot.admin:
            return
        with self.db:
            self.db.execute(
                "INSERT OR REPLACE INTO admin_state VALUES (?,?)",
                (self.bot.admin, json.dumps(data, ensure_ascii=False)),
            )

    def state(self):
        if not self.bot.admin:
            return {}
        row = self.db.execute("SELECT data FROM admin_state WHERE chat=?", (self.bot.admin,)).fetchone()
        return json.loads(row[0]) if row else {}

    def home(self, chat, message_id=None):
        counts = {r[0]: r[1] for r in self.db.execute("SELECT status,COUNT(*) FROM bookings GROUP BY status")}
        pending_outbox = self.db.execute("SELECT COUNT(*) FROM outbox WHERE sent=0").fetchone()[0]
        text = (
            "<b>DEZ REMKA · админ</b>\n\n"
            f"Новые заявки: <b>{counts.get('new', 0)}</b>\n"
            f"Принятые: <b>{counts.get('accepted', 0)}</b>\n"
            f"Отклонённые: <b>{counts.get('rejected', 0)}</b>\n"
            f"Ожидают оплаты: <b>{counts.get('awaiting_payment', 0)}</b>\n"
            f"Истёкшие счета: <b>{counts.get('expired', 0)}</b>\n"
            f"Сообщения в очереди: <b>{pending_outbox}</b>"
        )
        rows = [
            [b("Новые", "adm:list:new:0", "primary"), b("Принятые", "adm:list:accepted:0")],
            [b("Отклонённые", "adm:list:rejected:0"), b("Все", "adm:list:all:0")],
            [b("Главное меню бота", "menu:home")],
        ]
        self.save({})
        if message_id:
            self.api.edit(chat, message_id, text, rows)
        else:
            self.api.send(chat, text, rows)

    def listing(self, chat, status, page=0, message_id=None):
        where, params = ("", []) if status == "all" else (" WHERE status=?", [status])
        rows = self.db.execute(
            "SELECT id,data,status,payment_status FROM bookings" + where + " ORDER BY id DESC LIMIT 11 OFFSET ?",
            params + [page * 10],
        ).fetchall()
        items = rows[:10]
        title = "Все заказы" if status == "all" else f"Заказы · {STATUS.get(status, status)}"
        lines = [f"<b>{title}</b>"]
        if not items:
            lines.append("\nЗдесь пока пусто.")
        else:
            for row in items:
                data = json.loads(row["data"])
                paid = PAYMENT.get(row["payment_status"], row["payment_status"] or "—")
                lines.append(f"\n№{row['id']} · {h(data.get('name', 'Без имени'))} · {paid}")
        buttons = [[b(f"Заказ №{row['id']}", f"adm:card:{row['id']}")] for row in items]
        nav = []
        if page:
            nav.append(b("← Назад", f"adm:list:{status}:{page-1}"))
        if len(rows) > 10:
            nav.append(b("Дальше →", f"adm:list:{status}:{page+1}"))
        if nav:
            buttons.append(nav)
        buttons.append([b("Админ-панель", "adm:home")])
        if message_id:
            self.api.edit(chat, message_id, "".join(lines), buttons)
        else:
            self.api.send(chat, "".join(lines), buttons)

    def card(self, chat, number, message_id=None):
        row = self.db.execute("SELECT * FROM bookings WHERE id=?", (number,)).fetchone()
        if row is None:
            self.api.send(chat, "Заказ не найден.", [[b("Админ-панель", "adm:home")]])
            return
        data = json.loads(row["data"])
        text = (
            f"<b>Заказ №{number} · {STATUS.get(row['status'], row['status'])}</b>\n\n"
            f"{h(self.bot.booking_summary(data))}\n\n"
            f"Оплата: <b>{h(PAYMENT.get(row['payment_status'], row['payment_status'] or '—'))}</b>"
        )
        if row["amount"]:
            text += f" · {money(row['amount'] // 100)}"
        rows = []
        if row["status"] == "new":
            rows.append([b("Принять", f"adm:decision:{number}:accepted", "success"), b("Отклонить", f"adm:decision:{number}:rejected", "danger")])
        rows.extend([
            [b("Памятка до", f"adm:template:{number}:before"), b("Памятка после", f"adm:template:{number}:after")],
            [b("Написать клиенту", f"adm:write:{number}")],
            [b("К списку", "adm:list:all:0"), b("Админ-панель", "adm:home")],
        ])
        self.save({"booking": number})
        if message_id:
            self.api.edit(chat, message_id, text, rows)
        else:
            self.api.send(chat, text, rows)

    def flush(self):
        for row in self.db.execute("SELECT * FROM outbox WHERE sent=0 ORDER BY id LIMIT 20").fetchall():
            try:
                self.api.send(row["chat"], row["text"], [self.bot.home_button()])
            except Exception:
                continue
            with self.db:
                self.db.execute("UPDATE outbox SET sent=1 WHERE id=?", (row["id"],))

    def handle(self, message):
        chat = message.get("chat", {}).get("id")
        user = message.get("from", {}).get("id")
        text = (message.get("text") or "").strip()
        if text == "/admin" and (chat != self.bot.admin or user != self.bot.admin):
            self.api.send(chat, "Панель доступна только администратору.", [self.bot.home_button()])
            return True
        if chat != self.bot.admin or user != self.bot.admin:
            return False
        if text == "/admin":
            self.home(chat)
            return True
        state = self.state()
        if state.get("writing"):
            if text == "/cancel":
                self.home(chat)
                return True
            if not 2 <= len(text) <= 2500:
                self.api.send(chat, "Сообщение должно быть от 2 до 2500 символов.", [[b("Отмена", "adm:home")]])
                return True
            number = state["booking"]
            self.save({"booking": number, "pending": text})
            self.api.send(
                chat,
                "<b>Предпросмотр</b>\n\n" + h(text),
                [[b("Отправить клиенту", f"adm:send:{number}", "success")], [b("Отмена", f"adm:card:{number}")]],
            )
            return True
        return False

    def handle_callback(self, query):
        chat = query.get("message", {}).get("chat", {}).get("id")
        user = query.get("from", {}).get("id")
        if chat != self.bot.admin or user != self.bot.admin:
            self.api.answer_callback(query["id"], "Панель доступна только администратору.", True)
            return True
        action = query.get("data", "")
        message_id = query.get("message", {}).get("message_id")
        self.api.answer_callback(query["id"])
        if action == "adm:home":
            self.home(chat, message_id)
            return True
        if action.startswith("adm:list:"):
            _, _, status, page = action.split(":", 3)
            self.listing(chat, status, int(page), message_id)
            return True
        if action.startswith("adm:card:"):
            self.card(chat, int(action.rsplit(":", 1)[1]), message_id)
            return True
        if action.startswith("adm:decision:"):
            _, _, number, status = action.split(":", 3)
            number = int(number)
            row = self.db.execute("SELECT * FROM bookings WHERE id=?", (number,)).fetchone()
            if not row:
                self.home(chat, message_id)
                return True
            notice = (
                f"<b>Заказ №{number}</b> принят в работу. Специалист свяжется с вами для подтверждения времени выезда."
                if status == "accepted"
                else f"<b>Заказ №{number}</b> отклонён. Для уточнения свяжитесь со специалистом: {h(self.bot.config.get('phone', ''))}"
            )
            with self.db:
                changed = self.db.execute("UPDATE bookings SET status=? WHERE id=? AND status='new'", (status, number)).rowcount
                if changed:
                    self.db.execute("INSERT INTO outbox(booking,chat,text) VALUES (?,?,?)", (number, row["chat"], notice))
            self.card(chat, number, message_id)
            return True
        if action.startswith("adm:template:"):
            _, _, number, key = action.split(":", 3)
            number = int(number)
            text = self.bot.config.get(key, "")
            self.save({"booking": number, "pending": text})
            self.api.edit(
                chat,
                message_id,
                "<b>Предпросмотр памятки</b>\n\n" + h(text),
                [[b("Отправить клиенту", f"adm:send:{number}", "success")], [b("Назад", f"adm:card:{number}")]],
            )
            return True
        if action.startswith("adm:write:"):
            number = int(action.rsplit(":", 1)[1])
            self.save({"booking": number, "writing": True})
            self.api.edit(
                chat,
                message_id,
                f"<b>Сообщение клиенту · заказ №{number}</b>\n\nНапишите текст одним сообщением. Перед отправкой будет предпросмотр.",
                [[b("Отмена", f"adm:card:{number}")]],
            )
            return True
        if action.startswith("adm:send:"):
            number = int(action.rsplit(":", 1)[1])
            state = self.state()
            row = self.db.execute("SELECT chat FROM bookings WHERE id=?", (number,)).fetchone()
            if row and state.get("pending"):
                with self.db:
                    self.db.execute(
                        "INSERT INTO outbox(booking,chat,text) VALUES (?,?,?)",
                        (number, row["chat"], f"<b>DEZ REMKA · заказ №{number}</b>\n\n{h(state['pending'])}"),
                    )
                self.save({"booking": number})
            self.card(chat, number, message_id)
            return True
        return False