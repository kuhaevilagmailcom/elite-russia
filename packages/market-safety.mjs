import { randomUUID, createHash } from "node:crypto";
export const hashToken = (t) => createHash("sha256").update(t).digest("hex");
export function environment(env) {
  const mode = env.APP_ENV || "development";
  if (
    !["development", "test", "restricted", "staging", "production"].includes(
      mode,
    )
  )
    throw Error("Unknown APP_ENV");
  if (["production", "staging"].includes(mode))
    throw Error(
      "PostgreSQL runtime and production verification are not complete; startup refused",
    );
  for (const flag of [
    "LIVE_FINANCE_ENABLED",
    "LIVE_DEPOSITS_ENABLED",
    "LIVE_WITHDRAWALS_ENABLED",
    "CUSTODY_ENABLED",
    "GIFT_DEPOSITS_ENABLED",
    "GIFT_WITHDRAWALS_ENABLED",
    "TESTNET_DEPOSITS_ENABLED",
  ])
    if (env[flag] === "true") throw Error(`${flag}: integration not approved`);
  return { mode, demo: ["development", "test"].includes(mode) };
}
export const features = (env, demo) =>
  Object.fromEntries(
    [
      "MARKET",
      "OFFERS",
      "COLLECTION_OFFERS",
      "QUICK_SELL",
      "BUNDLES",
      "SWEEP",
      "SWAP",
    ].map((k) => [k, demo && env[k + "_ENABLED"] !== "false"]),
  );
export function checkAction(flags, a) {
  const group = {
    offer: "OFFERS",
    accept: "OFFERS",
    cancel: "OFFERS",
    "collection-offer": "COLLECTION_OFFERS",
    "collection-fill": "COLLECTION_OFFERS",
    "collection-cancel": "COLLECTION_OFFERS",
    "bundle-create": "BUNDLES",
    "bundle-buy": "BUNDLES",
    "bundle-cancel": "BUNDLES",
    "bulk-buy": "SWEEP",
    "partial-buy": "SWEEP",
    "swap-create": "SWAP",
    "swap-accept": "SWAP",
    "swap-cancel": "SWAP",
  }[a];
  if (!flags.MARKET || (group && !flags[group]))
    throw Error("Функция отключена сервером");
}
export function integrity(m) {
  const issues = [],
    sums = new Map();
  for (const a of m.all("SELECT * FROM accounts")) sums.set(a.id, 0n);
  for (const j of m.all("SELECT * FROM journal")) {
    if (
      !sums.has(j.src) ||
      !sums.has(j.dst) ||
      j.src === j.dst ||
      typeof j.amount !== "bigint" ||
      j.amount <= 0n
    ) {
      issues.push("Invalid journal " + j.id);
      continue;
    }
    sums.set(j.src, sums.get(j.src) - j.amount);
    sums.set(j.dst, sums.get(j.dst) + j.amount);
  }
  for (const a of m.all("SELECT * FROM accounts"))
    if (a.balance !== sums.get(a.id) || (a.id !== "treasury" && a.balance < 0n))
      issues.push("Account mismatch " + a.id);
  for (const u of m.all("SELECT id FROM users")) {
    const expected =
      m
        .all("SELECT price FROM offers WHERE buyer=? AND status='active'", u.id)
        .reduce((s, o) => s + o.price, 0n) +
      m
        .all(
          "SELECT price,remaining FROM collection_offers WHERE buyer=? AND status='active'",
          u.id,
        )
        .reduce((s, o) => s + o.price * o.remaining, 0n);
    if (m.balance(u.id).reserved !== expected)
      issues.push("Reserve mismatch " + u.id);
  }
  for (const l of m.all(
    "SELECT l.id FROM listings l JOIN gifts g ON g.id=l.gift WHERE l.status='active' AND l.seller<>g.owner",
  ))
    issues.push("Listing owner mismatch " + l.id);
  return { ok: !issues.length, issues, checkedAt: Date.now() };
}
export function quote(m, u, id, version) {
  const l = m.get("SELECT * FROM listings WHERE id=? AND status='active'", id);
  if (!l || l.seller === u || String(l.version) !== String(version))
    throw Error("Объявление изменилось или недоступно");
  const q = {
    id: randomUUID(),
    user: u,
    listing: l.id,
    gift: l.gift,
    version: String(l.version),
    price: String(l.price),
    fee: String((l.price * 2n) / 100n),
    total: String(l.price),
    currency: "TEST",
    expires: Date.now() + 120000,
  };
  m.run(
    "INSERT INTO quotes VALUES (?,?,?,?,?,?,?,?)",
    q.id,
    u,
    q.listing,
    q.gift,
    l.version,
    l.price,
    q.expires,
    0,
  );
  return q;
}
export function consumeQuote(m, u, id) {
  const q = m.get(
    "SELECT * FROM quotes WHERE id=? AND user=? AND used=0 AND expires>?",
    id,
    u,
    Date.now(),
  );
  if (!q) throw Error("Котировка истекла или использована");
  const l = m.get(
    "SELECT * FROM listings WHERE id=? AND status='active'",
    q.listing,
  );
  if (!l || l.price !== q.price || l.gift !== q.gift || l.version !== q.version)
    throw Error("Цена изменилась. Подтвердите заново");
  const r = m.buy(u, q.listing, q.version);
  m.run("UPDATE quotes SET used=1 WHERE id=?", id);
  return r;
}
export function swapCreate(m, u, b) {
  const { to, give, take } = b;
  if (to === u || !m.get("SELECT 1 FROM users WHERE id=?", to))
    throw Error("Получатель не найден");
  if (
    ![give, take].every(
      (a) =>
        Array.isArray(a) &&
        a.length &&
        a.length <= 10 &&
        a.every((x) => typeof x === "string"),
    ) ||
    new Set([...give, ...take]).size !== give.length + take.length
  )
    throw Error("Некорректный состав обмена");
  for (const [owner, ids] of [
    [u, give],
    [to, take],
  ])
    for (const id of ids) swapGift(m, owner, id);
  const id = randomUUID();
  m.run(
    "INSERT INTO swaps VALUES (?,?,?,?,?,?,?,?)",
    id,
    u,
    to,
    JSON.stringify(give),
    JSON.stringify(take),
    "pending",
    Date.now(),
    Date.now() + 86400000,
  );
  m.notify(to, "Получено предложение обмена");
  return { id };
}
function swapGift(m, u, id) {
  m.unlocked(id);
  if (
    !m.get("SELECT 1 FROM gifts WHERE id=? AND owner=?", id, u) ||
    m.get("SELECT 1 FROM listings WHERE gift=? AND status='active'", id) ||
    m.get("SELECT 1 FROM offers WHERE gift=? AND status='active'", id)
  )
    throw Error("Подарок недоступен для обмена");
}
export function swapAccept(m, u, id) {
  const s = m.get(
    "SELECT * FROM swaps WHERE id=? AND recipient=? AND status='pending' AND expires>?",
    id,
    u,
    Date.now(),
  );
  if (!s) throw Error("Обмен недоступен");
  const give = JSON.parse(s.give),
    take = JSON.parse(s.take);
  for (const [owner, ids] of [
    [s.sender, give],
    [u, take],
  ])
    for (const g of ids) swapGift(m, owner, g);
  for (const g of give) m.transfer(g, s.sender, u, id);
  for (const g of take) m.transfer(g, u, s.sender, id);
  m.run("UPDATE swaps SET status='accepted' WHERE id=?", id);
  m.notify(s.sender, "Обмен завершён");
  m.notify(u, "Обмен завершён");
  return { id };
}
export function swapCancel(m, u, id) {
  if (
    !m.run(
      "UPDATE swaps SET status='cancelled' WHERE id=? AND (sender=? OR recipient=?) AND status='pending'",
      id,
      u,
      u,
    ).changes
  )
    throw Error("Обмен недоступен");
  return { id };
}
