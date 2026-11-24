import { createHash, randomBytes, randomUUID } from "node:crypto";

export class GiveawayService {
  constructor(
    repo,
    { now = () => Date.now(), random = () => randomBytes(32) } = {},
  ) {
    this.repo = repo;
    this.now = now;
    this.random = random;
  }

  async initialize() {
    await this.repo.exec(`
      CREATE TABLE IF NOT EXISTS giveaways (id TEXT PRIMARY KEY, organizer TEXT NOT NULL REFERENCES users(id), gift TEXT NOT NULL REFERENCES gifts(id), title TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','completed','cancelled')), starts BIGINT NOT NULL, ends BIGINT NOT NULL, created BIGINT NOT NULL, winner TEXT REFERENCES users(id), random_hash TEXT);
      CREATE TABLE IF NOT EXISTS giveaway_entries (giveaway TEXT NOT NULL REFERENCES giveaways(id), "user" TEXT NOT NULL REFERENCES users(id), created BIGINT NOT NULL, PRIMARY KEY(giveaway,"user"));
      CREATE TABLE IF NOT EXISTS giveaway_locks (gift TEXT PRIMARY KEY REFERENCES gifts(id), giveaway TEXT NOT NULL UNIQUE REFERENCES giveaways(id));
      CREATE TABLE IF NOT EXISTS giveaway_requests ("user" TEXT NOT NULL, key TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY("user",key));
    `);
  }

  async list(user = null) {
    const rows = await this.repo.all(
      `SELECT x.*,g.collection,g.number,g.model,g.backdrop,g.symbol,g.art,
       (SELECT COUNT(*) FROM giveaway_entries e WHERE e.giveaway=x.id) participants
       FROM giveaways x JOIN gifts g ON g.id=x.gift ORDER BY x.created DESC LIMIT 100`,
    );
    if (!user) return rows;
    const entries = new Set(
      (
        await this.repo.all(
          'SELECT giveaway FROM giveaway_entries WHERE "user"=?',
          user,
        )
      ).map((x) => x.giveaway),
    );
    return rows.map((x) => ({ ...x, joined: entries.has(x.id) }));
  }

  async create(user, key, input) {
    if (typeof key !== "string" || !/^[A-Za-z0-9-]{8,80}$/.test(key))
      throw Error("Не указан Idempotency-Key");
    const title = String(input?.title || "").trim();
    const hours = Number(input?.hours);
    if (
      title.length < 3 ||
      title.length > 100 ||
      ![1, 6, 24, 72, 168].includes(hours)
    )
      throw Error("Проверьте название и срок розыгрыша");
    return this.repo.tx(async () => {
      const old = await this.repo.get(
        'SELECT result FROM giveaway_requests WHERE "user"=? AND key=?',
        user,
        key,
      );
      if (old) return JSON.parse(old.result);
      const gift = await this.repo.get(
        "SELECT * FROM gifts WHERE id=? AND owner=?",
        input.gift,
        user,
      );
      if (!gift) throw Error("Подарок не принадлежит организатору");
      if (
        (await this.repo.get(
          "SELECT 1 FROM listings WHERE gift=? AND status='active'",
          gift.id,
        )) ||
        (await this.repo.get(
          "SELECT 1 FROM offers WHERE gift=? AND status='active'",
          gift.id,
        )) ||
        (await this.repo.get(
          "SELECT 1 FROM bundle_locks WHERE gift=?",
          gift.id,
        )) ||
        (await this.repo.get(
          "SELECT 1 FROM giveaway_locks WHERE gift=?",
          gift.id,
        ))
      )
        throw Error("Подарок занят в другой операции");
      const id = randomUUID();
      const starts = this.now();
      const result = {
        id,
        gift: gift.id,
        starts,
        ends: starts + hours * 3_600_000,
      };
      await this.repo.run(
        "INSERT INTO giveaways(id,organizer,gift,title,status,starts,ends,created) VALUES (?,?,?,?,?,?,?,?)",
        id,
        user,
        gift.id,
        title,
        "active",
        result.starts,
        result.ends,
        starts,
      );
      await this.repo.run(
        "INSERT INTO giveaway_locks VALUES (?,?)",
        gift.id,
        id,
      );
      await this.repo.run(
        "INSERT INTO giveaway_requests VALUES (?,?,?)",
        user,
        key,
        JSON.stringify(result),
      );
      return result;
    });
  }

  async enter(user, id) {
    return this.repo.tx(async () => {
      const giveaway = await this.repo.get(
        "SELECT * FROM giveaways WHERE id=? AND status='active'",
        id,
      );
      if (!giveaway || Number(giveaway.ends) <= this.now())
        throw Error("Розыгрыш завершён");
      if (giveaway.organizer === user)
        throw Error("Организатор не может участвовать");
      try {
        await this.repo.run(
          "INSERT INTO giveaway_entries VALUES (?,?,?)",
          id,
          user,
          this.now(),
        );
      } catch {
        throw Error("Вы уже участвуете");
      }
      return { id, joined: true };
    });
  }

  async settle(actor, id, { admin = false } = {}) {
    return this.repo.tx(async () => {
      const giveaway = await this.repo.get(
        "SELECT * FROM giveaways WHERE id=? AND status='active'",
        id,
      );
      if (!giveaway || (!admin && giveaway.organizer !== actor))
        throw Error("Розыгрыш недоступен");
      if (Number(giveaway.ends) > this.now())
        throw Error("Розыгрыш ещё не завершён");
      const entries = await this.repo.all(
        'SELECT "user" FROM giveaway_entries WHERE giveaway=? ORDER BY created,"user"',
        id,
      );
      const seed = this.random();
      const digest = createHash("sha256").update(seed).update(id).digest();
      const winner = entries.length
        ? entries[Number(digest.readBigUInt64BE() % BigInt(entries.length))]
            .user
        : giveaway.organizer;
      if (winner !== giveaway.organizer) {
        const moved = await this.repo.run(
          "UPDATE gifts SET owner=? WHERE id=? AND owner=?",
          winner,
          giveaway.gift,
          giveaway.organizer,
        );
        if (!moved.changes) throw Error("Владение призом изменилось");
        await this.repo.run(
          "INSERT INTO ownership VALUES (?,?,?,?,?,?)",
          randomUUID(),
          giveaway.gift,
          giveaway.organizer,
          winner,
          id,
          this.now(),
        );
        await this.repo.run(
          "INSERT INTO notifications VALUES (?,?,?,?)",
          randomUUID(),
          winner,
          "Вы выиграли подарок в розыгрыше",
          this.now(),
        );
      }
      await this.repo.run(
        "UPDATE giveaways SET status='completed',winner=?,random_hash=? WHERE id=?",
        winner,
        digest.toString("hex"),
        id,
      );
      await this.repo.run("DELETE FROM giveaway_locks WHERE giveaway=?", id);
      return {
        id,
        winner,
        participants: entries.length,
        randomHash: digest.toString("hex"),
      };
    });
  }
}
