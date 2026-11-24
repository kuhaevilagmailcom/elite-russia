import test from "node:test";
import assert from "node:assert/strict";
import { Market, unit } from "../core.mjs";
const setup = () => new Market(":memory:", true);
let seq = 0;
const act = (m, u, a, b) => m.mutate(u, `test-${++seq}-key`, a, b);
const total = (m) =>
  m.all("SELECT balance FROM accounts").reduce((a, r) => a + r.balance, 0n);
test("collection offer reserves full amount, partial fill and cancellation release exact remainder", () => {
  const m = setup(),
    g = m.inventory("demo").find((x) => x.collection === "Astral Shard");
  const o = act(m, "buyer", "collection-offer", {
    collection: g.collection,
    price: "3",
    quantity: 3,
  });
  assert.equal(m.balance("buyer").reserved, 11_500_000_000n);
  act(m, "demo", "collection-fill", {
    id: o.id,
    gift: g.id,
    price: String(3n * unit),
  });
  assert.equal(m.orderbook()[0].remaining, 2n);
  assert.equal(m.balance("buyer").reserved, 8_500_000_000n);
  act(m, "buyer", "collection-cancel", { id: o.id });
  assert.equal(m.balance("buyer").reserved, 2_500_000_000n);
  assert.equal(m.inventory("buyer").find((x) => x.id === g.id).owner, "buyer");
  assert.equal(total(m), 0n);
});
test("collection offer rejects wrong attributes, stale quote, self fill and unauthorized cancel", () => {
  const m = setup(),
    g = m.inventory("demo")[1],
    o = act(m, "buyer", "collection-offer", {
      collection: g.collection,
      model: g.model,
      price: "4",
      quantity: 1,
    });
  assert.throws(() => act(m, "seller", "collection-cancel", { id: o.id }));
  assert.throws(() =>
    act(m, "demo", "collection-fill", { id: o.id, gift: g.id, price: "1" }),
  );
  assert.throws(() =>
    act(m, "demo", "collection-fill", {
      id: o.id,
      gift: m.inventory("demo")[0].id,
      price: String(4n * unit),
    }),
  );
  assert.throws(() =>
    act(m, "buyer", "collection-fill", {
      id: o.id,
      gift: g.id,
      price: String(4n * unit),
    }),
  );
  act(m, "demo", "collection-fill", {
    id: o.id,
    gift: g.id,
    price: String(4n * unit),
  });
  assert.equal(m.orderbook().length, 0);
  assert.throws(() =>
    act(m, "demo", "collection-fill", {
      id: o.id,
      gift: g.id,
      price: String(4n * unit),
    }),
  );
  assert.equal(total(m), 0n);
});
test("collection offer expiration releases unused reserve", () => {
  const m = setup(),
    g = m.inventory("demo")[0],
    o = act(m, "demo", "collection-offer", {
      collection: g.collection,
      price: "1.2",
      quantity: 2,
    });
  m.run(
    "UPDATE collection_offers SET expires=? WHERE id=?",
    Date.now() - 100,
    o.id,
  );
  m.tx(() => m.expire());
  assert.equal(m.balance("demo").reserved, 0n);
  assert.equal(m.orderbook().length, 0);
});
function createBundle(m) {
  const gs = m.market().slice(0, 2);
  for (const g of gs) act(m, "seller", "delist", { gift: g.id });
  return {
    gs,
    b: act(m, "seller", "bundle-create", {
      gifts: gs.map((g) => g.id),
      price: "5",
    }),
  };
}
test("bundle locks all assets against independent list, offer and transfer; sale atomic", () => {
  const m = setup(),
    { gs, b } = createBundle(m),
    g = gs[0];
  assert.throws(() => act(m, "seller", "list", { gift: g.id, price: "1" }));
  assert.throws(() => act(m, "demo", "offer", { gift: g.id, price: "1" }));
  assert.throws(() => act(m, "seller", "send", { gift: g.id, to: "demo" }));
  assert.throws(() => act(m, "demo", "bundle-buy", { id: b.id, version: "9" }));
  const before = m.balance("demo").available;
  act(m, "demo", "bundle-buy", { id: b.id, version: "1" });
  assert.equal(m.balance("demo").available, before - 5n * unit);
  for (const x of gs)
    assert.equal(m.inventory("demo").find((y) => y.id === x.id).bundle, null);
  assert.equal(m.bundles().length, 0);
  assert.throws(() =>
    act(m, "buyer", "bundle-buy", { id: b.id, version: "1" }),
  );
  assert.equal(total(m), 0n);
});
test("bundle creation rolls back all locks on invalid member", () => {
  const m = setup(),
    g = m.market()[0];
  act(m, "seller", "delist", { gift: g.id });
  assert.throws(() =>
    act(m, "seller", "bundle-create", { gifts: [g.id, "fake"], price: "5" }),
  );
  assert.equal(m.bundles().length, 0);
  assert.equal(m.inventory("seller").find((x) => x.id === g.id).bundle, null);
});
test("bundle cancellation releases locks only for seller", () => {
  const m = setup(),
    { gs, b } = createBundle(m);
  assert.throws(() => act(m, "demo", "bundle-cancel", { id: b.id }));
  act(m, "seller", "bundle-cancel", { id: b.id });
  act(m, "seller", "list", { gift: gs[0].id, price: "5" });
  assert.equal(m.bundles().length, 0);
});
test("partial checkout buys eligible items, rolls back stale item", () => {
  const m = setup(),
    [g, h] = m.market(),
    before = m.balance("demo").available;
  const result = act(m, "demo", "partial-buy", {
    items: [
      { id: g.listing, version: String(g.version) },
      { id: h.listing, version: "99" },
    ],
  });
  assert.equal(result[0].ok, true);
  assert.equal(result[1].ok, false);
  assert.equal(m.balance("demo").available, before - g.price);
  assert.equal(m.market().length, 9);
  assert.equal(total(m), 0n);
});
test("analytics use active listings and verified internal sales only", () => {
  const m = setup(),
    g = m.market()[0];
  assert.ok(m.analytics().some((c) => c.collection === g.collection));
  act(m, "demo", "buy", { id: g.listing, version: String(g.version) });
  assert.ok(!m.market().some((x) => x.id === g.id));
  assert.equal(total(m), 0n);
});
