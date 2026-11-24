import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Market, money, verifyTelegram, unit } from "../core.mjs";
const setup = () => new Market(":memory:", true);
const buy = (m, i = 0) => {
  const g = m.market()[i];
  return { id: g.listing, version: String(g.version) };
};
const total = (m) =>
  m.all("SELECT balance FROM accounts").reduce((a, r) => a + r.balance, 0n);
test("exact nano units and invalid decimal", () => {
  assert.equal(money("12.345678901"), 12345678901n);
  for (const x of ["0", "-1", "1e2", "1.0000000001", 12])
    assert.throws(() => money(x));
});
test("purchase atomic, ownership and balanced ledger", () => {
  const m = setup(),
    g = m.market()[0],
    before = m.balance("demo").available;
  const b = buy(m);
  m.mutate("demo", "purchase-1", "buy", b);
  assert.equal(m.balance("demo").available, before - g.price);
  assert.equal(m.inventory("demo").find((x) => x.id === g.id).owner, "demo");
  assert.equal(total(m), 0n);
  assert.throws(() => m.mutate("buyer", "purchase-2", "buy", b));
  assert.equal(total(m), 0n);
});
test("idempotent retry and conflict", () => {
  const m = setup(),
    b = buy(m);
  const x = m.mutate("demo", "purchase-1", "buy", b),
    v = m.balance("demo").available;
  assert.deepEqual(m.mutate("demo", "purchase-1", "buy", b), x);
  assert.equal(m.balance("demo").available, v);
  assert.throws(() =>
    m.mutate("demo", "purchase-1", "buy", { ...b, version: 99 }),
  );
});
test("price version conflict and unauthorized listing", () => {
  const m = setup(),
    g = m.market()[0],
    b = buy(m);
  assert.throws(() =>
    m.mutate("demo", "bad-list-1", "list", { gift: g.id, price: "2" }),
  );
  m.mutate("seller", "reprice-1", "list", { gift: g.id, price: "19" });
  assert.throws(() => m.mutate("demo", "purchase-1", "buy", b));
  assert.equal(m.balance("demo").available, 100n * unit);
});
test("offer reservation, cancellation and acceptance", () => {
  const m = setup(),
    g = m.market()[0];
  let r = m.mutate("demo", "offer-001", "offer", { gift: g.id, price: "5" });
  assert.equal(m.balance("demo").reserved, 5n * unit);
  m.mutate("demo", "cancel-01", "cancel", { id: r.id });
  assert.equal(m.balance("demo").reserved, 0n);
  r = m.mutate("demo", "offer-002", "offer", { gift: g.id, price: "5" });
  assert.throws(() => m.mutate("buyer", "accept-00", "accept", { id: r.id }));
  m.mutate("seller", "accept-01", "accept", { id: r.id });
  assert.equal(m.balance("demo").reserved, 0n);
  assert.equal(m.inventory("demo").find((x) => x.id === g.id).owner, "demo");
  assert.equal(total(m), 0n);
});
test("bulk purchase rolls back on duplicate", () => {
  const m = setup(),
    b = buy(m),
    before = m.balance("demo").available;
  assert.throws(() =>
    m.mutate("demo", "bulk-0001", "bulk-buy", { items: [b, b] }),
  );
  assert.equal(m.balance("demo").available, before);
  assert.equal(m.market().length, 10);
});
test("insufficient funds not charged", () => {
  const m = setup(),
    g = m.market()[0];
  m.mutate("seller", "reprice-1", "list", { gift: g.id, price: "999" });
  const l = m.market().find((x) => x.id === g.id);
  assert.throws(() =>
    m.mutate("demo", "purchase-1", "buy", {
      id: l.listing,
      version: String(l.version),
    }),
  );
  assert.equal(m.balance("demo").available, 100n * unit);
});
test("expired offers release reserve", () => {
  const m = setup(),
    g = m.market()[0],
    r = m.mutate("demo", "offer-001", "offer", { gift: g.id, price: "5" });
  m.run("UPDATE offers SET expires=? WHERE id=?", Date.now() - 1, r.id);
  m.tx(() => m.expire());
  assert.equal(m.balance("demo").reserved, 0n);
});
test("journal cannot be rewritten", () => {
  const m = setup();
  assert.throws(() => m.run("DELETE FROM journal"));
  assert.throws(() => m.run("UPDATE journal SET amount=1"));
});
test("restricted mode refuses trading and does not seed", () => {
  const m = new Market(":memory:", false);
  assert.equal(m.market().length, 0);
  assert.throws(() => m.mutate("demo", "purchase-1", "buy", {}));
});
test("Telegram signature verified, tampering and expiry rejected", () => {
  const token = "test-token",
    now = 1700000000;
  const p = new URLSearchParams({
    auth_date: String(now),
    user: JSON.stringify({ id: 123, first_name: "Test" }),
  });
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  p.set(
    "hash",
    createHmac("sha256", secret)
      .update(
        [...p]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => k + "=" + v)
          .join("\n"),
      )
      .digest("hex"),
  );
  assert.equal(verifyTelegram(p.toString(), token, now).id, "123");
  assert.throws(() => verifyTelegram(p.toString(), token, now + 301));
  p.set("user", '{"id":124}');
  assert.throws(() => verifyTelegram(p.toString(), token, now));
});
