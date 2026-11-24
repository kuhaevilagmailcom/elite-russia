import test from "node:test";
import assert from "node:assert/strict";
import { BOT_COMMANDS, TelegramBotService } from "../packages/telegram-bot.mjs";

test("bot configures required commands, menu and webhook without leaking token", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({
      method: url.split("/").at(-1),
      body: JSON.parse(options.body),
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: { username: "minion_market_bot" },
      }),
    };
  };
  const bot = new TelegramBotService({
    token: "123456:secret-token",
    appUrl: "https://market.example/",
    webhookSecret: "webhook-secret",
    fetcher,
  });
  const result = await bot.configure();
  assert.equal(result.username, "minion_market_bot");
  assert.deepEqual(
    BOT_COMMANDS.map((x) => x.command),
    [
      "start",
      "market",
      "inventory",
      "wallet",
      "offers",
      "giveaways",
      "profile",
      "support",
      "help",
    ],
  );
  assert.equal(
    calls.find((x) => x.method === "setChatMenuButton").body.menu_button.text,
    "Маркет",
  );
  assert.equal(
    calls.find((x) => x.method === "setWebhook").body.secret_token,
    "webhook-secret",
  );
  assert.ok(
    calls.every((x) => !JSON.stringify(x).includes("123456:secret-token")),
  );
});

test("bot opens requested Mini App section", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({
      method: url.split("/").at(-1),
      body: JSON.parse(options.body),
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: true }),
    };
  };
  const bot = new TelegramBotService({
    token: "123456:secret-token",
    appUrl: "https://market.example",
    fetcher,
  });
  assert.equal(
    await bot.handle({
      message: { chat: { id: 42, type: "private" }, text: "/giveaways" },
    }),
    true,
  );
  const message = calls.at(-1).body;
  assert.match(message.text, /^MINION MARKET/);
  assert.equal(
    message.reply_markup.inline_keyboard[0][0].web_app.url,
    "https://market.example/?startapp=giveaways",
  );
});
