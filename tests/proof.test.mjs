import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  proofDigest,
  verifyProof,
  ProofService,
} from "../packages/blockchain/ton-proof.mjs";
import { SQLiteRepository } from "../packages/database/repository.mjs";
import { TelegramAPI } from "../packages/telegram.mjs";
const { privateKey, publicKey } = generateKeyPairSync("ed25519"),
  key = publicKey.export({ type: "spki", format: "der" }).subarray(-32),
  address = "0:" + "ab".repeat(32),
  domain = "market.example",
  network = "-3";
const resolver = async (i) => {
  if (i.address !== address || i.proof.state_init !== "fixture")
    throw Error("StateInit mismatch");
  return key;
};
function fixture(payload = "a".repeat(43)) {
  const p = {
    domain: { value: domain, lengthBytes: domain.length },
    timestamp: Math.floor(Date.now() / 1000),
    payload,
    state_init: "fixture",
  };
  p.signature = sign(null, proofDigest(address, p), privateKey).toString(
    "base64",
  );
  return { address, network, public_key: key.toString("hex"), proof: p };
}
const opts = {
  domain,
  network,
  challenge: "a".repeat(43),
  resolveKey: resolver,
};
test("TON proof cryptographic Ed25519 verification with injected test address resolver", async () =>
  assert.deepEqual(await verifyProof(fixture(), opts), { address, network }));
test("TON proof rejects changed domain, length, signature, key, address, state, timestamp, nonce and network", async () => {
  for (const mutate of [
    (x) => (x.proof.domain.value = "evil.example"),
    (x) => x.proof.domain.lengthBytes++,
    (x) => (x.proof.signature = Buffer.alloc(64).toString("base64")),
    (x) => (x.public_key = "11".repeat(32)),
    (x) => (x.address = "0:" + "cd".repeat(32)),
    (x) => (x.proof.state_init = "wrong"),
    (x) => (x.proof.timestamp -= 600),
    (x) => (x.proof.payload = "b".repeat(43)),
    (x) => (x.network = "-239"),
  ]) {
    const x = fixture();
    mutate(x);
    await assert.rejects(() => verifyProof(x, opts));
  }
});
test("TON challenge is user/session bound and consumed once under parallel verify", async () => {
  const repo = await SQLiteRepository.open();
  try {
    await repo.run("INSERT INTO users VALUES (?,?)", "u", "Test");
    await repo.run(
      "INSERT INTO sessions VALUES (?,?,?)",
      "session",
      "u",
      Date.now() + 100000,
    );
    const s = new ProofService(repo, { domain, network, resolveKey: resolver });
    await s.initialize();
    const c = await s.challenge("u", "session"),
      x = fixture(c.payload);
    await assert.rejects(() => s.verify("other", "session", x));
    await assert.rejects(() => s.verify("u", "wrong", x));
    const result = await Promise.allSettled([
      s.verify("u", "session", x),
      s.verify("u", "session", x),
    ]);
    assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal((await s.connection("u")).address, address);
    await s.disconnect("u");
    assert.equal(await s.connection("u"), null);
  } finally {
    await repo.close();
  }
});
test("collectible catalog fetch uses Telegram unique gift method and rejects mismatched identity", async () => {
  const api = new TelegramAPI("123:abc", async (url, options) => {
    assert.ok(url.endsWith("/getUniqueGift"));
    assert.deepEqual(JSON.parse(options.body), { name: "Example-1" });
    return {
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          name: "Example-1",
          base_name: "Example",
          number: 1,
          model: { name: "Model", rarity_per_mille: 20 },
        },
      }),
    };
  });
  const g = await api.uniqueGift("Example-1");
  assert.equal(g.modelRarity, 20);
  assert.equal(g.slug, "Example-1");
  await assert.rejects(() => api.uniqueGift("https://evil.example"));
});
