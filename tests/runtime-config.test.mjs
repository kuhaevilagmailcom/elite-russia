import test from "node:test";
import assert from "node:assert/strict";
import { normalizedEnv } from "../packages/runtime-config.mjs";

test("configuration aliases resolve in both directions", () => {
  const env = normalizedEnv({
    BOT_TOKEN: "token",
    DATABASE_PATH: "db.sqlite",
    ADMIN_TELEGRAM_IDS: "1,2",
  });
  assert.equal(env.TELEGRAM_BOT_TOKEN, "token");
  assert.equal(env.DB_PATH, "db.sqlite");
  assert.equal(env.ADMIN_IDS, "1,2");
});

test("conflicting secret aliases fail closed without exposing values", () => {
  assert.throws(
    () =>
      normalizedEnv({
        BOT_TOKEN: "first-secret",
        TELEGRAM_BOT_TOKEN: "second-secret",
      }),
    (error) =>
      !error.message.includes("first-secret") &&
      !error.message.includes("second-secret"),
  );
});

test("BotHost config uses its HTTPS domain and persistent SQLite storage", () => {
  const env = normalizedEnv({
    BOT_ID: "bot_123",
    BOT_TOKEN: "123:secret",
    DOMAIN: "market.example.bothost.tech",
    DATA_DIR: "/app/data/",
    PORT: "3000",
  });
  assert.equal(env.APP_ENV, "restricted");
  assert.equal(env.APP_URL, "https://market.example.bothost.tech");
  assert.equal(env.BIND_HOST, "0.0.0.0");
  assert.equal(env.DATABASE_DRIVER, "sqlite");
  assert.equal(env.DB_PATH, "/app/data/minion.sqlite");
  assert.match(env.TELEGRAM_WEBHOOK_SECRET, /^[a-f0-9]{64}$/);
});

test("explicit BotHost configuration remains authoritative", () => {
  const env = normalizedEnv({
    BOT_ID: "bot_123",
    APP_ENV: "test",
    APP_URL: "https://custom.example",
    DATABASE_DRIVER: "postgres",
    DATABASE_URL: "postgresql://example",
  });
  assert.equal(env.APP_ENV, "test");
  assert.equal(env.APP_URL, "https://custom.example");
  assert.equal(env.DATABASE_DRIVER, "postgres");
});
