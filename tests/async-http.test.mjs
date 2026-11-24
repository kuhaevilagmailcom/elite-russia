import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { createServer } from "node:net";
async function run(mode, fn) {
  const dir = await mkdtemp(join(tmpdir(), "mm-http-")),
    s = createServer();
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const port = s.address().port;
  await new Promise((r) => s.close(r));
  const base = `http://127.0.0.1:${port}`,
    p = spawn(process.execPath, ["--experimental-sqlite", "server-async.mjs"], {
      env: {
        ...process.env,
        APP_ENV: mode,
        PORT: String(port),
        DB_PATH: join(dir, "db.sqlite"),
        BIND_HOST: "127.0.0.1",
        TELEGRAM_BOT_TOKEN: "123:local-test",
      },
      stdio: "ignore",
    });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        ready = (await fetch(base + "/health")).ok;
        if (ready) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.ok(ready, "server startup");
    const call = async (path, method = "GET", body, token, key) => {
      const r = await fetch(base + "/api/v1/" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, data: await r.json() };
    };
    await fn(call);
  } finally {
    if (p.exitCode === null) {
      p.kill();
      await new Promise((r) => p.once("exit", r));
    }
    await rm(dir, { recursive: true, force: true });
  }
}
test("ASYNC HTTP auth, role separation, quote purchase, repeat and concurrent race", async () =>
  run("development", async (call) => {
    const login = async (account) =>
      (await call("auth", "POST", { demo: true, account })).data.token;
    const [a, b, s] = await Promise.all(["demo", "buyer", "seller"].map(login));
    assert.equal((await call("state")).status, 401);
    assert.equal((await call("admin", "GET", null, b)).status, 403);
    assert.equal((await call("admin", "GET", null, a)).status, 200);
    const { data: market } = await call("market"),
      g = market[0];
    const [qa, qb] = await Promise.all(
      [a, b].map((t) =>
        call("quote", "POST", { id: g.listing, version: g.version }, t),
      ),
    );
    const results = await Promise.all([
      call("action/quote-buy", "POST", { id: qa.data.id }, a, "http-buy-a"),
      call("action/quote-buy", "POST", { id: qb.data.id }, b, "http-buy-b"),
    ]);
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    const idx = results.findIndex((r) => r.status === 200),
      winner = [a, b][idx],
      q = [qa, qb][idx];
    assert.deepEqual(
      (
        await call(
          "action/quote-buy",
          "POST",
          { id: q.data.id },
          winner,
          ["http-buy-a", "http-buy-b"][idx],
        )
      ).data,
      results[idx].data,
    );
    assert.ok(
      (await call("state", "GET", null, winner)).data.inventory.some(
        (x) => x.id === g.id,
      ),
    );
    assert.ok((await call("admin", "GET", null, a)).data.health.ledger.ok);
    await call("logout", "POST", {}, s);
    assert.equal((await call("state", "GET", null, s)).status, 401);
  }));
test("ASYNC restricted mode has no seeded assets, rejects demo and replay, authenticates signed initData", async () =>
  run("restricted", async (call) => {
    assert.deepEqual((await call("market")).data, []);
    assert.equal((await call("auth", "POST", { demo: true })).status, 400);
    const p = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 123, first_name: "Contract test" }),
    });
    const key = createHmac("sha256", "WebAppData")
      .update("123:local-test")
      .digest();
    p.set(
      "hash",
      createHmac("sha256", key)
        .update(
          [...p]
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([k, v]) => `${k}=${v}`)
            .join("\n"),
        )
        .digest("hex"),
    );
    const r = await call("auth", "POST", { initData: p.toString() });
    assert.equal(r.status, 200);
    assert.equal(
      (await call("auth", "POST", { initData: p.toString() })).status,
      400,
    );
    assert.equal(
      (await call("action/buy", "POST", {}, r.data.token, "restricted-buy"))
        .status,
      400,
    );
    assert.equal(
      (await call("state", "GET", null, r.data.token)).data.balance.available,
      "0",
    );
  }));
