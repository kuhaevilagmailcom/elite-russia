import { ProofService } from "./blockchain/ton-proof.mjs";
import { TelegramAPI } from "./telegram.mjs";
import { CustodyEvidence } from "./custody/reconciliation.mjs";
import { rolesFromEnv, hasPermission } from "./rbac.mjs";
import { hashToken } from "./market-safety.mjs";
import { GiveawayService } from "./giveaways.mjs";
import { PersonalGifts } from "./personal-gifts.mjs";
export async function beta2Routes(repo, env, demo) {
  const url = new URL(env.APP_URL || "http://localhost:3000");
  const network = env.TON_NETWORK === "mainnet" ? "-239" : "-3";
  const configured = !demo && url.protocol === "https:" && ["mainnet","testnet"].includes(env.TON_NETWORK);
  const personal = new PersonalGifts(repo, !demo && env.TELEGRAM_BOT_TOKEN ? new TelegramAPI(env.TELEGRAM_BOT_TOKEN) : null);
  await personal.initialize();
  const roles = rolesFromEnv(env);
  const evidence = new CustodyEvidence(repo);
  await evidence.initialize();
  const proof = new ProofService(repo, { domain: url.host, network });
  await proof.initialize();
  const giveaways = new GiveawayService(repo);
  await giveaways.initialize();
  await repo.exec(
    "CREATE TABLE IF NOT EXISTS collectible_catalog (slug TEXT PRIMARY KEY, payload TEXT NOT NULL, checked BIGINT NOT NULL)",
  );
  return async ({ path, method, u, q, r, json, body, admin }) => {
    const can = (permission) =>
      admin(u) || hasPermission(roles.get(u.id), permission);
    const session = hashToken((q.headers.authorization || "").slice(7));
    if (path === "/api/v1/giveaways" && method === "GET") {
      json(r, 200, {
        enabled: env.GIVEAWAYS_ENABLED !== "false",
        items: await giveaways.list(u.id),
      });
      return true;
    }
    if (path === "/api/v1/giveaways" && method === "POST") {
      if (env.GIVEAWAYS_ENABLED === "false")
        json(r, 503, { error: "Розыгрыши отключены" });
      else
        json(
          r,
          200,
          await giveaways.create(
            u.id,
            q.headers["idempotency-key"],
            await body(q),
          ),
        );
      return true;
    }
    const giveawayAction = path.match(
      /^\/api\/v1\/giveaways\/([^/]+)\/(join|settle)$/,
    );
    if (giveawayAction && method === "POST") {
      const [, id, action] = giveawayAction;
      json(
        r,
        200,
        action === "join"
          ? await giveaways.enter(u.id, id)
          : await giveaways.settle(u.id, id, { admin: admin(u) }),
      );
      return true;
    }
    if (path === "/api/v1/wallet/connection" && method === "GET") {
      json(r, 200, {
        connection: await proof.connection(u.id),
        enabled: configured,
        network,
      });
      return true;
    }
    if (path === "/api/v1/wallet/connection" && method === "DELETE") {
      json(r, 200, await proof.disconnect(u.id));
      return true;
    }
    if (path.startsWith("/api/v1/wallet/proof/")) {
      if (!configured) {
        json(r, 503, {
          error: "TON Proof требует restricted mode, HTTPS и настроенную сеть TON",
        });
        return true;
      }
      if (method === "POST" && path.endsWith("/challenge")) {
        json(r, 200, await proof.challenge(u.id, session));
        return true;
      }
      if (method === "POST" && path.endsWith("/verify")) {
        json(r, 200, await proof.verify(u.id, session, await body(q)));
        return true;
      }
    }
    if(path==="/api/v1/personal-gifts/refresh-media"&&method==="POST"){
      if(!personal.api){json(r,503,{error:"Telegram не настроен"});return true;}
      json(r,200,await personal.refreshMedia(u.id));return true;
    }
    if (path === "/api/v1/personal-gifts") {
      if (method === "GET") {
        json(r,200,{items:await personal.list(u.id),enabled:!!personal.api});
        return true;
      }
      if (method === "POST" || method === "DELETE") {
        if (!personal.api) { json(r,503,{error:"Импорт доступен только в Telegram с настроенным ботом"}); return true; }
        const input=await body(q);
        const result=method==="POST" ? await personal.add(u.id,input.link) : await personal.remove(u.id,input.slug);
        json(r,200,result);
        return true;
      }
    }
    if (path === "/api/v1/collectibles" && method === "GET") {
      const rows = await repo.all(
        "SELECT payload FROM collectible_catalog ORDER BY checked DESC LIMIT 200",
      );
      json(r, 200, {
        items: rows.map((x) => {
          const item = JSON.parse(x.payload);
          return {
            ...item,
            modelMediaUrl: (item.modelPreviewFile ?? (item.modelAnimationFile||item.modelVideoFile?null:item.modelFile)) ? `/api/v1/media/telegram/${encodeURIComponent(item.modelPreviewFile ?? item.modelFile)}` : null,
            modelAnimationUrl:item.modelAnimationFile?`/api/v1/media/telegram/${encodeURIComponent(item.modelAnimationFile)}`:null,
            modelVideoUrl:item.modelVideoFile?`/api/v1/media/telegram/${encodeURIComponent(item.modelVideoFile)}`:null,
          };
        }),
        source: "Telegram metadata; not listed assets",
      });
      return true;
    }
    if (path === "/api/v1/admin/collectibles" && method === "POST") {
      if (!can("catalog.write")) {
        json(r, 403, { error: "Нет доступа" });
        return true;
      }
      if (demo || !env.TELEGRAM_BOT_TOKEN) {
        json(r, 503, { error: "Telegram catalog not configured" });
        return true;
      }
      const { slug } = await body(q);
      const item = await new TelegramAPI(env.TELEGRAM_BOT_TOKEN).uniqueGift(
        slug,
      );
      await repo.run(
        "INSERT INTO collectible_catalog VALUES (?,?,?) ON CONFLICT(slug) DO UPDATE SET payload=excluded.payload,checked=excluded.checked",
        item.slug,
        JSON.stringify(item),
        item.verifiedAt,
      );
      json(r, 200, item);
      return true;
    }
    if (path === "/api/v1/admin/custody/evidence" && method === "GET") {
      if (!can("custody.read")) json(r, 403, { error: "Нет доступа" });
      else
        json(r, 200, {
          items: env.TELEGRAM_CUSTODY_CONNECTION_ID
            ? await evidence.list(env.TELEGRAM_CUSTODY_CONNECTION_ID)
            : [],
          credited: 0,
        });
      return true;
    }
    if (path === "/api/v1/admin/custody/sync" && method === "POST") {
      if (!admin(u)) {
        json(r, 403, { error: "Нет доступа" });
        return true;
      }
      if (
        demo ||
        !env.TELEGRAM_BOT_TOKEN ||
        !env.TELEGRAM_CUSTODY_CONNECTION_ID ||
        !env.TELEGRAM_CUSTODY_OWNER_ID
      ) {
        json(r, 503, { error: "Custody not configured" });
        return true;
      }
      const snapshot = await new TelegramAPI(env.TELEGRAM_BOT_TOKEN).custody(
        env.TELEGRAM_CUSTODY_CONNECTION_ID,
        env.TELEGRAM_CUSTODY_OWNER_ID,
      );
      json(
        r,
        200,
        await evidence.reconcile(env.TELEGRAM_CUSTODY_CONNECTION_ID, snapshot),
      );
      return true;
    }
    const readPaths = {
      "/api/v1/admin/finance/ledger": [
        "finance.read",
        "SELECT id,kind,src,dst,amount,ref,created FROM journal ORDER BY created DESC LIMIT 100",
      ],
      "/api/v1/admin/support/tickets": [
        "support.read",
        'SELECT id,"user",message,status,created FROM tickets ORDER BY created DESC LIMIT 100',
      ],
      "/api/v1/admin/analytics/summary": [
        "analytics.read",
        "SELECT COUNT(*) AS trades FROM activity WHERE type='sold'",
      ],
    };
    if (method === "GET" && Object.hasOwn(readPaths, path)) {
      const [permission, sql] = readPaths[path];
      if (!can(permission)) json(r, 403, { error: "Нет доступа" });
      else json(r, 200, { items: await repo.all(sql) });
      return true;
    }
    return false;
  };
}
