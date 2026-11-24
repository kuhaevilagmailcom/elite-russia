import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteRepository } from "../packages/database/repository.mjs";
import { CustodyEvidence } from "../packages/custody/reconciliation.mjs";
import { rolesFromEnv, hasPermission } from "../packages/rbac.mjs";
test("custody observations reconcile missing gifts without crediting assets", async () => {
  const r = await SQLiteRepository.open();
  try {
    const c = new CustodyEvidence(r);
    await c.initialize();
    const now = Date.now(),
      g = { ownedGiftId: "owned", slug: "Example-1", sender: "123" };
    let s = await c.reconcile("connection", { items: [g], checkedAt: now });
    assert.equal(s.credited, 0);
    assert.equal((await c.list("connection"))[0].status, "OBSERVED_SENDER");
    await c.reconcile("connection", { items: [g], checkedAt: now + 1 });
    assert.equal(
      (await r.get("SELECT COUNT(*) AS n FROM custody_evidence_journal")).n,
      1n,
    );
    await c.reconcile("connection", { items: [], checkedAt: now + 2 });
    assert.equal((await c.list("connection"))[0].status, "MISSING");
    await c.reconcile("connection", { items: [g], checkedAt: now + 3 });
    assert.equal((await c.list("connection"))[0].status, "MANUAL_REVIEW");
    assert.equal((await r.get("SELECT COUNT(*) AS n FROM gifts")).n, 0n);
    await assert.rejects(() =>
      c.reconcile("connection", { items: [g, g], checkedAt: now + 4 }),
    );
    await assert.rejects(() =>
      c.reconcile("connection", {
        items: [{ ...g, slug: "Other-1" }],
        checkedAt: now + 5,
      }),
    );
  } finally {
    await r.close();
  }
});
test("RBAC restricts finance, support, moderators and read only to assigned scopes", () => {
  const map = rolesFromEnv({
    ADMIN_IDS: "5",
    ADMIN_ROLES_JSON: '{"10":"Finance","11":"Support","12":"Moderator"}',
  });
  assert.ok(hasPermission(map.get("5"), "catalog.write"));
  assert.ok(hasPermission(map.get("10"), "finance.read"));
  assert.ok(!hasPermission(map.get("10"), "catalog.write"));
  assert.ok(!hasPermission(map.get("11"), "finance.read"));
  assert.ok(hasPermission(map.get("12"), "custody.read"));
  assert.throws(() => rolesFromEnv({ ADMIN_ROLES_JSON: '{"1":"root"}' }));
});
