import test from "node:test";
import assert from "node:assert/strict";
import { AsyncMarket, unit } from "../core-async.mjs";
import {
  SQLiteRepository,
  PostgresRepository,
  pgSQL,
} from "../packages/database/repository.mjs";
const make = async () => {
  const repo = await SQLiteRepository.open();
  const m = new AsyncMarket(repo, true);
  await m.initialize();
  return { repo, m };
};
test("async repository: purchases race and rollback, idempotency, ledger", async () => {
  const { repo, m } = await make();
  try {
    const g = (await m.market())[0];
    const results = await Promise.allSettled(
      ["demo", "buyer"].map((u) =>
        m.mutate(u, "async-buy-" + u, "buy", {
          id: g.listing,
          version: String(g.version),
        }),
      ),
    );
    assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
    const idx = results.findIndex((x) => x.status === "fulfilled"),
      u = ["demo", "buyer"][idx];
    assert.deepEqual(
      await m.mutate(u, "async-buy-" + u, "buy", {
        id: g.listing,
        version: String(g.version),
      }),
      results[idx].value,
    );
    assert.ok((await m.inventory(u)).some((x) => x.id === g.id));
    assert.ok((await m.integrity()).ok);
    const bad = await m.balance(u);
    await assert.rejects(() =>
      m.mutate(u, "invalid-batch", "mass-list", {
        items: [
          { gift: g.id, price: "1" },
          { gift: "missing", price: "2" },
        ],
      }),
    );
    assert.deepEqual(await m.balance(u), bad);
    assert.equal(
      (await m.inventory(u)).find((x) => x.id === g.id).listing,
      null,
    );
  } finally {
    await repo.close();
  }
});
test("async repository: collection offer partial fill and reserve release", async () => {
  const { repo, m } = await make();
  try {
    const o = await m.mutate("buyer", "async-offer", "collection-offer", {
      collection: "Jelly Bunny",
      price: "2",
      quantity: 2,
    });
    const before = await m.balance("buyer");
    assert.equal(before.reserved, 6500000000n);
    await m.mutate("seller", "async-fill", "collection-fill", {
      id: o.id,
      gift: "gift-5",
      price: "2000000000",
    });
    await m.mutate("buyer", "async-cancel", "collection-cancel", { id: o.id });
    assert.equal((await m.balance("buyer")).reserved, 2500000000n);
    assert.ok((await m.integrity()).ok);
  } finally {
    await repo.close();
  }
});
test("async repository: bundle and swap remain atomic", async () => {
  const { repo, m } = await make();
  try {
    await m.mutate("seller", "async-delist1", "delist", { gift: "gift-1" });
    await m.mutate("seller", "async-delist2", "delist", { gift: "gift-2" });
    const b = await m.mutate("seller", "async-bundle", "bundle-create", {
      gifts: ["gift-1", "gift-2"],
      price: "3",
    });
    await m.mutate("demo", "async-bundle-buy", "bundle-buy", {
      id: b.id,
      version: "1",
    });
    const s = await m
      .mutate("demo", "async-swap", "swap-create", {
        to: "buyer",
        give: ["gift-1"],
        take: [],
      })
      .catch((e) => e);
    assert.ok(s instanceof Error);
    assert.equal(
      (await m.inventory("demo")).filter((g) =>
        ["gift-1", "gift-2"].includes(g.id),
      ).length,
      2,
    );
    assert.ok((await m.integrity()).ok);
  } finally {
    await repo.close();
  }
});
test("async repository: integrity check shares transaction with mutation", async () => {
  const { repo, m } = await make();
  try {
    await repo.run(
      "UPDATE accounts SET balance=balance+1 WHERE id='demo:available'",
    );
    await assert.rejects(
      () =>
        m.mutate("demo", "async-corrupt", "list", {
          gift: "gift-12",
          price: "2",
        }),
      /целостности/,
    );
  } finally {
    await repo.close();
  }
});
test("postgres SQL parameter conversion preserves string literals and quoted identifiers", () => {
  assert.equal(
    pgSQL("SELECT '?' FROM sessions WHERE user=? AND token=?"),
    "SELECT '?' FROM sessions WHERE \"user\"=$1 AND token=$2",
  );
  assert.equal(
    pgSQL("INSERT OR IGNORE INTO accounts(id) VALUES (?)"),
    "INSERT INTO accounts(id) VALUES ($1) ON CONFLICT DO NOTHING",
  );
});
test("postgres connection refuses missing URL, no sqlite fallback", async () =>
  assert.rejects(() => PostgresRepository.open(""), /DATABASE_URL/));
import { LedgerV2 } from "../packages/database/ledger-v2.mjs";
test("Ledger V2: only touched balances checked per trade; independent full reconciliation", async () => {
  const { repo, m } = await make();
  try {
    const ledger = await new LedgerV2(m).initialize();
    let scans = 0;
    const original = m.integrity.bind(m);
    m.integrity = async () => {
      scans++;
      return original();
    };
    const g = (await m.market())[0];
    await m.mutate("demo", "v2-buy-one", "buy", {
      id: g.listing,
      version: String(g.version),
    });
    assert.equal(scans, 0);
    assert.ok((await ledger.reconcile()).ok);
    assert.equal(scans, 1);
    assert.ok(await ledger.healthy());
  } finally {
    await repo.close();
  }
});
test("Ledger V2: tampering blocks affected trade, persists pause across restart logic", async () => {
  const { repo, m } = await make();
  try {
    const ledger = await new LedgerV2(m).initialize(),
      g = (await m.market())[0];
    await repo.run(
      "UPDATE accounts SET balance=balance+1 WHERE id='demo:available'",
    );
    await assert.rejects(
      () =>
        m.mutate("demo", "v2-bad-buy", "buy", {
          id: g.listing,
          version: String(g.version),
        }),
      /projection mismatch/,
    );
    assert.equal(await ledger.healthy(), false);
    assert.equal(
      (await m.market()).find((x) => x.id === g.id).listing,
      g.listing,
    );
    await assert.rejects(
      () =>
        m.mutate("buyer", "v2-blocked", "buy", {
          id: g.listing,
          version: String(g.version),
        }),
      /приостановлена/,
    );
    assert.ok(!(await ledger.reconcile()).ok);
  } finally {
    await repo.close();
  }
});
test("Ledger V2: failed batch leaves projection and reservation unchanged", async () => {
  const { repo, m } = await make();
  try {
    const ledger = await new LedgerV2(m).initialize(),
      g = (await m.market())[0],
      before = await m.balance("demo");
    await assert.rejects(() =>
      m.mutate("demo", "v2-bulk-bad", "bulk-buy", {
        items: [
          { id: g.listing, version: String(g.version) },
          { id: "missing", version: "1" },
        ],
      }),
    );
    assert.deepEqual(await m.balance("demo"), before);
    assert.ok((await ledger.reconcile()).ok);
    assert.equal(
      (await m.market()).find((x) => x.id === g.id).listing,
      g.listing,
    );
  } finally {
    await repo.close();
  }
});
