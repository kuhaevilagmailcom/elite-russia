import test from "node:test";
import assert from "node:assert/strict";
import { Market, unit } from "../core.mjs";
import {
  environment,
  features,
  checkAction,
  hashToken,
} from "../packages/market-safety.mjs";
import { TelegramAPI } from "../packages/telegram.mjs";
let i = 0;
const setup = () => new Market(":memory:", true),
  act = (m, u, a, b) => m.mutate(u, "beta-key-" + ++i, a, b);
test("explicit development and restricted modes, unknown/staging/live fail closed", () => {
  assert.equal(environment({ APP_ENV: "development" }).demo, true);
  assert.equal(environment({ APP_ENV: "restricted" }).demo, false);
  for (const x of ["production", "staging", "typo"])
    assert.throws(() => environment({ APP_ENV: x }));
  assert.throws(() => environment({ LIVE_DEPOSITS_ENABLED: "true" }));
});
test("feature flags checked server side", () => {
  const f = features({ SWAP_ENABLED: "false" }, true);
  assert.throws(() => checkAction(f, "swap-create"));
  assert.doesNotThrow(() => checkAction(f, "buy"));
  assert.throws(() => checkAction(features({}, false), "buy"));
});
test("quote bound to user, version, price; single use and retry", () => {
  const m = setup(),
    g = m.market()[0],
    q = m.quote("demo", { id: g.listing, version: g.version });
  assert.throws(() => act(m, "buyer", "quote-buy", { id: q.id }));
  const r = m.mutate("demo", "quote-test-1", "quote-buy", { id: q.id });
  assert.deepEqual(
    m.mutate("demo", "quote-test-1", "quote-buy", { id: q.id }),
    r,
  );
  assert.throws(() => act(m, "demo", "quote-buy", { id: q.id }));
  assert.ok(m.integrity().ok);
});
test("stale and expired quotes cannot charge user", () => {
  const m = setup(),
    g = m.market()[0],
    q = m.quote("demo", { id: g.listing, version: g.version });
  act(m, "seller", "list", { gift: g.id, price: "18" });
  assert.throws(() => act(m, "demo", "quote-buy", { id: q.id }));
  const q2 = m.quote("demo", { id: g.listing, version: 2 });
  m.run("UPDATE quotes SET expires=0 WHERE id=?", q2.id);
  assert.throws(() => act(m, "demo", "quote-buy", { id: q2.id }));
  assert.equal(m.balance("demo").available, 100n * unit);
});
test("integrity detects tampered account and blocks trade", () => {
  const m = setup();
  assert.ok(m.integrity().ok);
  m.run("UPDATE accounts SET balance=balance+1 WHERE id='demo:available'");
  assert.equal(m.integrity().ok, false);
  assert.throws(() => act(m, "demo", "buy", {}));
});
test("reserve mismatch caught independently of balanced journal", () => {
  const m = setup();
  m.tx(() =>
    m.post("demo:available", "demo:reserved", unit, "bad_reserve", "test"),
  );
  assert.ok(m.integrity().issues.some((s) => s.includes("Reserve mismatch")));
});
test("ledger rejects overflow and rolls back", () => {
  const m = setup();
  assert.throws(() =>
    m.tx(() =>
      m.post("treasury", "demo:available", 9223372036854775807n, "test", "x"),
    ),
  );
  assert.ok(m.integrity().ok);
});
test("mass listing atomic, cannot include foreign gifts", () => {
  const m = setup();
  assert.throws(() =>
    act(m, "demo", "mass-list", {
      items: [
        { gift: "gift-12", price: "4" },
        { gift: "gift-1", price: "3" },
      ],
    }),
  );
  assert.equal(
    m.inventory("demo").find((g) => g.id === "gift-12").listing,
    null,
  );
  act(m, "demo", "mass-list", { items: [{ gift: "gift-12", price: "4" }] });
  assert.ok(m.market().find((g) => g.id === "gift-12"));
});
function swapSetup() {
  const m = setup();
  act(m, "seller", "delist", { gift: "gift-1" });
  return m;
}
test("swap requires recipient consent and moves both gifts atomically", () => {
  const m = swapSetup(),
    s = act(m, "demo", "swap-create", {
      to: "seller",
      give: ["gift-12"],
      take: ["gift-1"],
    });
  assert.throws(() => act(m, "demo", "swap-accept", s));
  assert.throws(() => act(m, "buyer", "swap-accept", s));
  act(m, "seller", "swap-accept", s);
  assert.equal(
    m.inventory("demo").find((g) => g.id === "gift-1").owner,
    "demo",
  );
  assert.equal(
    m.inventory("seller").find((g) => g.id === "gift-12").owner,
    "seller",
  );
  assert.throws(() => act(m, "seller", "swap-accept", s));
  assert.ok(m.integrity().ok);
});
test("swap revalidates assets, stale proposal never moves either gift", () => {
  const m = swapSetup(),
    s = act(m, "demo", "swap-create", {
      to: "seller",
      give: ["gift-12"],
      take: ["gift-1"],
    });
  act(m, "seller", "list", { gift: "gift-1", price: "1" });
  assert.throws(() => act(m, "seller", "swap-accept", s));
  assert.ok(m.inventory("demo").some((g) => g.id === "gift-12"));
  assert.ok(m.inventory("seller").some((g) => g.id === "gift-1"));
});
test("randomized sequence preserves financial invariants", () => {
  const m = setup();
  let x = 42;
  for (let k = 0; k < 150; k++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    const g = m.market()[x % m.market().length];
    if (g) {
      try {
        act(m, ["demo", "buyer", "seller"][x % 3], "buy", {
          id: g.listing,
          version: g.version,
        });
      } catch {}
    }
    const u = ["demo", "buyer", "seller"][(x >>> 5) % 3],
      owned = m.inventory(u).find((g) => !g.listing && !g.bundle);
    if (owned) {
      try {
        act(m, u, "list", { gift: owned.id, price: String(1 + (x % 10)) });
      } catch {}
    }
    assert.ok(m.integrity().ok);
  }
});
test("Telegram adapter contracts: regular catalog distinct from unique custody", async () => {
  const api = new TelegramAPI("123:abc", async (url) => ({
    ok: true,
    json: async () => ({
      ok: true,
      result: url.endsWith("getAvailableGifts")
        ? { gifts: [{ id: "a", star_count: 10 }] }
        : url.endsWith("getBusinessConnection")
          ? {
              is_enabled: true,
              user: { id: 5 },
              rights: { can_view_gifts_and_stars: true },
            }
          : {
              gifts: [
                {
                  type: "unique",
                  owned_gift_id: "owned",
                  gift: { name: "Slug-1", number: 1 },
                },
              ],
            },
    }),
  }));
  assert.equal((await api.catalog())[0].type, "regular");
  assert.equal((await api.custody("x", "5")).items[0].sender, null);
  await assert.rejects(() => api.custody("x", "6"));
});
test("token digest deterministic and not plaintext", () => {
  assert.equal(hashToken("abc").length, 64);
  assert.notEqual(hashToken("abc"), "abc");
});
