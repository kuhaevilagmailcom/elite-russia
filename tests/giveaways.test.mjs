import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteRepository } from "../packages/database/repository.mjs";
import { AsyncMarket } from "../core-async.mjs";
import { GiveawayService } from "../packages/giveaways.mjs";

test("free giveaway locks prize, rejects duplicate entry and transfers ownership atomically", async () => {
  let now = 1_000_000;
  const repo = await SQLiteRepository.open(":memory:");
  const market = new AsyncMarket(repo, true);
  await market.initialize();
  const giveaways = new GiveawayService(repo, {
    now: () => now,
    random: () => Buffer.alloc(32, 7),
  });
  await giveaways.initialize();
  const created = await giveaways.create("demo", "giveaway-key-0001", {
    gift: "gift-12",
    title: "Jelly Bunny",
    hours: 1,
  });
  const repeated = await giveaways.create("demo", "giveaway-key-0001", {
    gift: "gift-12",
    title: "Jelly Bunny",
    hours: 1,
  });
  assert.deepEqual(repeated, created);
  await assert.rejects(
    () => market.list("demo", "gift-12", "1.00"),
    /розыгрыш/i,
  );
  await giveaways.enter("buyer", created.id);
  await assert.rejects(
    () => giveaways.enter("buyer", created.id),
    /уже участвуете/i,
  );
  now += 3_600_001;
  const result = await giveaways.settle("demo", created.id);
  assert.equal(result.winner, "buyer");
  assert.equal(
    (await repo.get("SELECT owner FROM gifts WHERE id='gift-12'")).owner,
    "buyer",
  );
  assert.equal(
    await repo.get("SELECT 1 FROM giveaway_locks WHERE gift='gift-12'"),
    undefined,
  );
  await repo.close();
});
