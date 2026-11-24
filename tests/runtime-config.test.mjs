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
