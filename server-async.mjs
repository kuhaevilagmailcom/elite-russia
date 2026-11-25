// GENERATED from server.mjs
import { beta2Routes } from "./packages/beta2-routes.mjs";
import { LedgerV2 } from "./packages/database/ledger-v2.mjs";
import { rolesFromEnv, hasPermission } from "./packages/rbac.mjs";
import http from "node:http";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { AsyncMarket, verifyTelegram } from "./core-async.mjs";
import {
  PostgresRepository,
  SQLiteRepository,
  asyncMap,
} from "./packages/database/repository.mjs";
import {
  environment,
  features,
  checkAction,
  hashToken,
} from "./packages/market-safety.mjs";
import { TelegramAPI } from "./packages/telegram.mjs";
import { TelegramBotService } from "./packages/telegram-bot.mjs";
import { normalizedEnv } from "./packages/runtime-config.mjs";
const env = normalizedEnv(),
  { mode, demo } = environment(env),
  flags = features(env, demo);
const port = Number(env.PORT || 3000),
  host = env.BIND_HOST || "127.0.0.1",
  url = env.APP_URL || `http://localhost:${port}`;
if (!demo && !env.TELEGRAM_BOT_TOKEN)
  console.warn("Telegram authorization is not configured");
if (
  env.DATABASE_DRIVER &&
  !["postgres", "sqlite"].includes(env.DATABASE_DRIVER)
)
  throw Error("Unknown DATABASE_DRIVER");
const repo =
  env.DATABASE_DRIVER === "postgres"
    ? await PostgresRepository.open(env.DATABASE_URL)
    : await SQLiteRepository.open(
        env.DB_PATH || `./data/${demo ? "demo" : "restricted"}.sqlite`,
      );
const market = new AsyncMarket(repo, demo);
await market.initialize();
const ledger = await new LedgerV2(market).initialize();
const beta2 = await beta2Routes(repo, env, demo);
// Invalidate old plaintext session tokens during upgrade; only digests remain in storage.
await market.tx(async () => {
  if (await market.get("SELECT v FROM meta WHERE k='hashed_sessions'")) return;
  await market.run("DELETE FROM sessions");
  await market.run("INSERT INTO meta VALUES ('hashed_sessions','1')");
});
const stringify = (v) =>
  JSON.stringify(v, (_, x) => (typeof x === "bigint" ? String(x) : x));
const json = (r, status, v) => {
  r.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  r.end(stringify(v));
};
async function body(q) {
  let n = 0,
    parts = [];
  for await (const c of q) {
    n += c.length;
    if (n > 65536) throw Error("Запрос слишком большой");
    parts.push(c);
  }
  const b = JSON.parse(Buffer.concat(parts).toString() || "{}");
  if (!b || typeof b !== "object" || Array.isArray(b))
    throw Error("Некорректный запрос");
  return b;
}
const rate = new Map(),
  health = {
    ledger: await ledger.reconcile(),
    telegram: { status: "NOT_CONFIGURED" },
    custody: { status: "NOT_CONFIGURED" },
    catalog: { status: "NOT_CONFIGURED" },
    ton: { status: "NOT_VERIFIED" },
    bot: { status: "NOT_CONFIGURED" },
  };
let bot = null;
const mediaCache = new Map();
if (!demo && env.TELEGRAM_BOT_TOKEN && url.startsWith("https://")) {
  bot = new TelegramBotService({
    token: env.TELEGRAM_BOT_TOKEN,
    appUrl: url,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
  });
  bot
    .configure()
    .then((result) => (health.bot = { status: "CONNECTED", ...result }))
    .catch(() => (health.bot = { status: "ERROR" }));
}
await market.db.exec(
  "CREATE TABLE IF NOT EXISTS integration_snapshots (kind TEXT PRIMARY KEY, payload TEXT NOT NULL, checked BIGINT NOT NULL)",
);
const loadSnapshot = async (k) => {
  const row = await market.get(
    "SELECT payload FROM integration_snapshots WHERE kind=?",
    k,
  );
  return row ? JSON.parse(row.payload) : [];
};
let catalog = await loadSnapshot("catalog"),
  custody = await loadSnapshot("custody");
async function snapshot(kind, items) {
  await market.run(
    "INSERT INTO integration_snapshots VALUES (?,?,?) ON CONFLICT(kind) DO UPDATE SET payload=excluded.payload,checked=excluded.checked",
    kind,
    JSON.stringify(items),
    Date.now(),
  );
}

async function maintenance() {
  try {
    if (demo && (await ledger.healthy()))
      await ledger.transaction(() => market.expire());
    await market.run("DELETE FROM sessions WHERE expires<?", Date.now());
    await market.run("DELETE FROM auth_replay WHERE expires<?", Date.now());
    health.ledger = await ledger.reconcile();
  } catch {
    health.ledger = { ok: false, issues: ["Maintenance failed"] };
  }
}
setInterval(async () => {
  rate.clear();
  await maintenance();
}, 60000).unref();
async function session(q) {
  const t = (q.headers.authorization || "").replace(/^Bearer /, "");
  if (!/^[a-f0-9]{64}$/.test(t)) return null;
  return await market.get(
    "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user WHERE token=? AND expires>?",
    hashToken(t),
    Date.now(),
  );
}
async function tokenFor(u) {
  const t = randomBytes(32).toString("hex");
  await market.run(
    "INSERT INTO sessions VALUES (?,?,?)",
    hashToken(t),
    u,
    Date.now() + 86400000,
  );
  return t;
}
const adminRoles = rolesFromEnv(env);
function admin(u) {
  return demo ? u.id === "demo" : hasPermission(adminRoles.get(u.id), "*");
}
const files = {
  "/": "index.html",
  "/admin": "index.html",
  "/app.js": "app.js",
  "/phosphor.js":"phosphor.js",
  "/lottie-light.min.js":"lottie-light.min.js",
  "/style.css": "style.css",
  "/logo.svg": "logo.svg",
  "/beta.js": "beta.js",
};
const mime = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
};
let streams = 0;
let checking = false;
async function integrations() {
  if (checking) throw Error("Проверка уже выполняется");
  checking = true;
  try {
    if (demo || !env.TELEGRAM_BOT_TOKEN) return health;
    const api = new TelegramAPI(env.TELEGRAM_BOT_TOKEN);
    async function check(key, fn) {
      try {
        await fn();
        health[key] = { status: "VERIFIED", checkedAt: Date.now() };
      } catch (e) {
        health[key] = {
          status: "ERROR",
          reason: e.message,
          checkedAt: Date.now(),
        };
      }
    }
    await check("telegram", () => api.call("getMe"));
    await check("catalog", async () => {
      catalog = await api.catalog();
      await snapshot("catalog", catalog);
    });
    if (env.TELEGRAM_CUSTODY_CONNECTION_ID && env.TELEGRAM_CUSTODY_OWNER_ID)
      await check("custody", async () => {
        custody = (
          await api.custody(
            env.TELEGRAM_CUSTODY_CONNECTION_ID,
            env.TELEGRAM_CUSTODY_OWNER_ID,
          )
        ).items;
        await snapshot("custody", custody);
      });
    return health;
  } finally {
    checking = false;
  }
}
const server = http.createServer(async (q, r) => {
  r.setHeader("X-Content-Type-Options", "nosniff");
  r.setHeader("Referrer-Policy", "no-referrer");
  r.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://telegram.org https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:; frame-src https:; object-src 'none'; base-uri 'self'; form-action 'self'",
  );
  r.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  try {
    const path = new URL(q.url, "http://localhost").pathname,
      method = q.method;
    if (method === "GET" && files[path]) {
      const f = files[path];
      r.writeHead(200, { "Content-Type": mime[f.split(".").at(-1)] });
      return r.end(readFileSync(new URL("public/" + f, import.meta.url)));
    }
    if (method === "GET" && path === "/tonconnect-manifest.json")
      return json(r, 200, {
        url,
        name: "MINION MARKET",
        iconUrl: url + "/logo.svg",
        termsOfUseUrl: url + "/terms",
        privacyPolicyUrl: url + "/privacy",
      });
    if (method === "GET" && ["/terms", "/privacy"].includes(path)) {
      r.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      return r.end(
        "Development preview. Real assets and payments are disabled. No financial service is offered. Production policies must be approved before launch.",
      );
    }
    if (path === "/health") {
      const ok = await ledger.healthy();
      return json(r, ok ? 200 : 503, { ok, mode });
    }
    if (path === "/ready") {
      const ledgerReady = await ledger.healthy();
      const databaseReady = Boolean(market.db);
      const ready = ledgerReady && databaseReady;
      return json(r, ready ? 200 : 503, {
        ready,
        mode,
        checks: {
          database: databaseReady ? "CONNECTED" : "ERROR",
          ledger: ledgerReady ? "READY" : "ERROR",
          telegramBot: health.bot.status,
          miniApp: url.startsWith("https://") ? "READY" : "LOCAL_ONLY",
          custody: health.custody.status,
          tonProof: health.ton.status,
          financialOperations: "DISABLED",
        },
      });
    }
    if (path === "/telegram/webhook" && method === "POST") {
      if (!bot) return json(r, 503, { error: "Telegram bot not configured" });
      if (!bot.accepts(q.headers["x-telegram-bot-api-secret-token"]))
        return json(r, 403, { error: "Invalid webhook secret" });
      await bot.handle(await body(q));
      return json(r, 200, { ok: true });
    }
    if (!path.startsWith("/api/v1/"))
      return json(r, 404, { error: "Не найдено" });
    const ip = q.socket.remoteAddress;
    rate.set(ip, (rate.get(ip) || 0) + 1);
    if (rate.get(ip) > 600)
      return json(r, 429, { error: "Слишком много запросов" });
    if (path === "/api/v1/config" && method === "GET")
      return json(r, 200, {
        demo,
        mode,
        flags,
        liveFinance: false,
        custody: env.TELEGRAM_CUSTODY_USERNAME || null,
        appUrl: url,
        network: env.TON_NETWORK === "mainnet" ? "mainnet" : "testnet",
        currency: env.MARKET_CURRENCY || "GRAM",
        integrations: {
          telegramBot: health.bot.status,
          custody: health.custody.status,
          tonProof: health.ton.status,
        },
      });
    if (method === "GET" && path.startsWith("/api/v1/media/telegram/")) {
      if (demo || !env.TELEGRAM_BOT_TOKEN)
        return json(r, 404, { error: "Telegram media not configured" });
      const fileId = decodeURIComponent(
        path.slice("/api/v1/media/telegram/".length),
      );
      let media = mediaCache.get(fileId);
      if (!media) {
        media = await new TelegramAPI(env.TELEGRAM_BOT_TOKEN).file(fileId);
        if (mediaCache.size >= 100)
          mediaCache.delete(mediaCache.keys().next().value);
        mediaCache.set(fileId, media);
      }
      r.writeHead(200, {
        "Content-Type": media.type,
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      });
      return r.end(media.body);
    }
    if (
      ["/api/v1/auth", "/api/v1/auth/telegram"].includes(path) &&
      method === "POST"
    ) {
      const b = await body(q);
      if (demo && b.demo === true) {
        const id = b.account || "demo";
        if (!["demo", "seller", "buyer"].includes(id))
          throw Error("Неизвестный тестовый аккаунт");
        const user = await market.get("SELECT * FROM users WHERE id=?", id);
        return json(r, 200, { token: await tokenFor(id), user });
      }
      if (demo)
        throw Error("Telegram авторизация доступна в restricted режиме");
      const u = verifyTelegram(b.initData, env.TELEGRAM_BOT_TOKEN);
      return json(
        r,
        200,
        await market.tx(async () => {
          if (
            await market.get("SELECT 1 FROM auth_replay WHERE hash=?", u.hash)
          )
            throw Error("Повторная авторизация");
          await market.run(
            "INSERT INTO auth_replay VALUES (?,?)",
            u.hash,
            Date.now() + 330000,
          );
          await market.user(u.id, u.name);
          return {
            token: await tokenFor(u.id),
            user: { id: u.id, name: u.name },
          };
        }),
      );
    }
    if (method === "GET") {
      if (path === "/api/v1/stream") {
        if (streams >= 20) return json(r, 429, { error: "Stream limit" });
        streams++;
        r.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        let last = null;
        const tick = async () => {
          const v =
            (
              await market.get(
                "SELECT id FROM activity ORDER BY created DESC,rowid DESC LIMIT 1",
              )
            )?.id || "";
          if (v !== last) {
            last = v;
            r.write(
              "event: market\ndata: " + JSON.stringify({ latest: v }) + "\n\n",
            );
          } else r.write(": heartbeat\n\n");
        };
        tick();
        const timer = setInterval(tick, 5000);
        r.on("close", () => {
          clearInterval(timer);
          streams--;
        });
        return;
      }
      if (path === "/api/v1/market") return json(r, 200, await market.market());
      if (path === "/api/v1/orderbook")
        return json(
          r,
          200,
          (await market.orderbook()).map(({ buyer, ...o }) => o),
        );
      if (path === "/api/v1/bundles")
        return json(
          r,
          200,
          (await market.bundles()).map(({ seller, ...o }) => o),
        );
      if (path === "/api/v1/analytics")
        return json(r, 200, await market.analytics());
      if (path === "/api/v1/catalog")
        return json(r, 200, {
          items: catalog,
          status: health.catalog,
          checkedAt:
            (
              await market.get(
                "SELECT checked FROM integration_snapshots WHERE kind='catalog'",
              )
            )?.checked || null,
        });
      if (path === "/api/v1/activity")
        return json(
          r,
          200,
          await market.all(
            "SELECT a.*,g.collection,g.number,g.art,g.backdrop FROM activity a JOIN gifts g ON a.gift=g.id ORDER BY a.created DESC LIMIT 100",
          ),
        );
    }
    const u = await session(q);
    if (!u) return json(r, 401, { error: "Требуется авторизация" });
    if (
      method === "GET" &&
      ["/api/v1/me", "/api/v1/auth/session"].includes(path)
    )
      return json(r, 200, { user: u });
    if (await beta2({ path, method, u, q, r, json, body, admin })) return;
    if (
      ["/api/v1/logout", "/api/v1/auth/logout"].includes(path) &&
      method === "POST"
    ) {
      await market.run(
        "DELETE FROM sessions WHERE token=?",
        hashToken(q.headers.authorization.slice(7)),
      );
      return json(r, 200, { ok: true });
    }
    if (path === "/api/v1/quote" && method === "POST") {
      checkAction(flags, "buy");
      return json(r, 200, await market.quote(u.id, await body(q)));
    }
    if (path === "/api/v1/swap-candidates" && method === "GET" && demo)
      return json(
        r,
        200,
        await market.all(
          "SELECT id,owner,collection,number,model FROM gifts WHERE owner<>? AND NOT EXISTS (SELECT 1 FROM listings l WHERE l.gift=gifts.id AND l.status='active') AND NOT EXISTS (SELECT 1 FROM bundle_locks b WHERE b.gift=gifts.id) AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.gift=gifts.id AND o.status='active')",
          u.id,
        ),
      );
    if (path === "/api/v1/state" && method === "GET")
      return json(r, 200, {
        user: u,
        collectionOffers: await market.all(
          "SELECT * FROM collection_offers WHERE buyer=? ORDER BY created DESC",
          u.id,
        ),
        ownBundles: (await market.bundles())
          .filter((b) => b.seller === u.id)
          .map((b) => b.id),
        balance: await market.balance(u.id),
        inventory: await market.inventory(u.id),
        tradeStats: await (async()=>{
          const rows=await market.all("SELECT kind,src,dst,amount,ref FROM journal WHERE kind IN ('sale','bundle_sale') AND (src IN (?,?) OR dst=?)",u.id+":available",u.id+":reserved",u.id+":available");
          const bought=new Set(),sold=new Set();let volume=0n;
          for(const row of rows){
            if(row.src===u.id+":available"||row.src===u.id+":reserved")bought.add(row.ref);
            if(row.dst===u.id+":available")sold.add(row.ref);
            volume+=BigInt(row.amount);
          }
          return {bought:bought.size,sold:sold.size,volume};
        })(),
        favorites: (
          await market.all("SELECT gift FROM favorites WHERE user=?", u.id)
        ).map((x) => x.gift),
        swaps: await market.all(
          "SELECT * FROM swaps WHERE sender=? OR recipient=? ORDER BY created DESC",
          u.id,
          u.id,
        ),
        offers: await market.all(
          "SELECT o.*,g.owner,g.collection,g.number FROM offers o JOIN gifts g ON g.id=o.gift WHERE (o.buyer=? OR g.owner=?) ORDER BY o.expires DESC",
          u.id,
          u.id,
        ),
        notifications: await market.all(
          "SELECT * FROM notifications WHERE user=? ORDER BY created DESC LIMIT 30",
          u.id,
        ),
        history: await market.all(
          "SELECT * FROM journal WHERE src IN (?,?) OR dst IN (?,?) ORDER BY created DESC LIMIT 50",
          u.id + ":available",
          u.id + ":reserved",
          u.id + ":available",
          u.id + ":reserved",
        ),
      });
    if (path.startsWith("/api/v1/admin")) {
      if (!admin(u)) return json(r, 403, { error: "Нет доступа" });
      if (path === "/api/v1/admin/integrations" && method === "POST")
        return json(r, 200, await integrations());
      if (path === "/api/v1/admin" && method === "GET")
        return json(r, 200, {
          users: await market.all("SELECT * FROM users"),
          gifts: await market.all("SELECT * FROM gifts"),
          accounts: await market.all("SELECT * FROM accounts"),
          ledger: await market.all(
            "SELECT * FROM journal ORDER BY created DESC LIMIT 100",
          ),
          tickets: await market.all("SELECT * FROM tickets"),
          listings: await market.market(),
          health: { ...health, ledger: await ledger.reconcile() },
          custody: demo ? [] : custody.map(({ sender, ...g }) => g),
          catalog,
        });
    }
    if (path.startsWith("/api/v1/action/") && method === "POST") {
      const action = path.split("/").at(-1);
      checkAction(flags, action);
      const b = await body(q);
      return json(
        r,
        200,
        await market.mutate(u.id, q.headers["idempotency-key"], action, b),
      );
    }
    return json(r, 404, { error: "Метод не найден" });
  } catch (e) {
    const msg = String(e.message || "Ошибка");
    return json(r, 400, {
      error: /SQLITE|constraint|SQL logic|UNIQUE|FOREIGN KEY/i.test(msg)
        ? "Операция отклонена базой данных"
        : msg,
    });
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.listen(port, host, () => console.log(`MINION MARKET ${mode} → ${url}`));
