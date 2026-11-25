import {giftAppearance} from "./gift-appearance.mjs";
import { decodeTgs } from "./tgs.mjs";
export class TelegramAPI {
  constructor(token, fetcher = fetch) {
    if (!token || !/^\d+:[\w-]+$/.test(token))
      throw Error("Telegram token not configured");
    this.token = token;
    this.fetcher = fetcher;
  }
  async call(method, params = {}) {
    let res;
    try {
      res = await this.fetcher(
        `https://api.telegram.org/bot${this.token}/${method}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw Error("Telegram API unavailable");
    }
    const j = await res.json();
    if (!res.ok || !j.ok)
      throw Error(
        `Telegram ${method}: HTTP ${res.status}, code ${j.error_code || "unknown"}`,
      );
    return j.result;
  }
  async catalog() {
    const r = await this.call("getAvailableGifts");
    if (!Array.isArray(r.gifts)) throw Error("Invalid gift catalog");
    return r.gifts.map((g) => ({
      id: String(g.id),
      type: "regular",
      stars: g.star_count,
      sticker: g.sticker?.file_id || null,
      source: "Telegram Bot API/getAvailableGifts",
      verifiedAt: Date.now(),
    }));
  }
  async uniqueGift(name) {
    if (typeof name !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(name))
      throw Error("Invalid gift slug");
    const g = await this.call("getUniqueGift", { name });
    if (
      g.name !== name ||
      !g.base_name ||
      !Number.isSafeInteger(g.number) ||
      g.number < 1
    )
      throw Error("Invalid gift identity");
    return {
      slug: g.name,
      collection: g.base_name,
      number: g.number,
      model: g.model?.name,
      backdrop: g.backdrop?.name,
      symbol: g.symbol?.name,
      modelRarity: g.model?.rarity_per_mille ?? null,
      backdropRarity: g.backdrop?.rarity_per_mille ?? null,
      symbolRarity: g.symbol?.rarity_per_mille ?? null,
      modelFile: g.model?.sticker?.file_id ?? null,
      modelPreviewFile: g.model?.sticker?.thumbnail?.file_id ?? (g.model?.sticker?.is_animated || g.model?.sticker?.is_video ? null : g.model?.sticker?.file_id ?? null),
      modelAnimationFile: g.model?.sticker?.is_animated ? g.model.sticker.file_id : null,
      modelVideoFile: g.model?.sticker?.is_video ? g.model.sticker.file_id : null,
      symbolFile: g.symbol?.sticker?.file_id ?? null,
      ...giftAppearance(g),mediaVersion:3,
      source: "Telegram Bot API/getUniqueGift",
      verifiedAt: Date.now(),
    };
  }
  async file(fileId) {
    if (
      typeof fileId !== "string" ||
      fileId.length < 5 ||
      fileId.length > 512 ||
      !/^[A-Za-z0-9_-]+$/.test(fileId)
    )
      throw Error("Invalid Telegram file id");
    const file = await this.call("getFile", { file_id: fileId });
    if (
      typeof file.file_path !== "string" ||
      file.file_path.includes("..") ||
      !/^[-A-Za-z0-9_./]+$/.test(file.file_path)
    )
      throw Error("Invalid Telegram file path");
    const response = await this.fetcher(
      `https://api.telegram.org/file/bot${this.token}/${file.file_path}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) throw Error(`Telegram file: HTTP ${response.status}`);
    const length = Number(response.headers?.get?.("content-length") || 0);
    if (length > 10_000_000) throw Error("Telegram file too large");
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > 10_000_000) throw Error("Telegram file too large");
    const extension = file.file_path.split(".").at(-1)?.toLowerCase();
    const type =
      {
        png: "image/png",
        webp: "image/webp",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webm: "video/webm",
        tgs: "application/gzip",
        json: "application/json",
      }[extension] || "application/octet-stream";
    if(extension==="tgs") return {body:decodeTgs(body),type:"application/json; charset=utf-8"};
    return { body, type };
  }
  async custody(connection, owner) {
    const c = await this.call("getBusinessConnection", {
      business_connection_id: connection,
    });
    if (
      !c.is_enabled ||
      String(c.user?.id) !== String(owner) ||
      !c.rights?.can_view_gifts_and_stars
    )
      throw Error("Custody account or permissions mismatch");
    const items = [],
      seen = new Set();
    let offset;
    for (let page = 0; page < 1000; page++) {
      const r = await this.call("getBusinessAccountGifts", {
        business_connection_id: connection,
        limit: 100,
        ...(offset ? { offset } : {}),
      });
      if (!Array.isArray(r.gifts)) throw Error("Invalid custody response");
      for (const g of r.gifts) {
        if (g.type !== "unique") continue;
        const slug = g.gift?.name,
          owned = g.owned_gift_id;
        if (typeof slug !== "string" || !owned || seen.has(owned))
          throw Error("Missing or repeated custody identity");
        seen.add(owned);
        items.push({
          ownedGiftId: owned,
          slug,
          sender: g.sender_user?.id ? String(g.sender_user.id) : null,
          number: g.gift.number,
          collection: g.gift.base_name || g.gift.name,
          model: g.gift.model?.name,
          backdrop: g.gift.backdrop?.name,
          symbol: g.gift.symbol?.name,
          transferStars: g.transfer_star_count ?? null,
          source: "Telegram Bot API/getBusinessAccountGifts",
        });
      }
      if (!r.next_offset)
        return {
          items,
          checkedAt: Date.now(),
          transferAllowed: Boolean(c.rights?.can_transfer_and_upgrade_gifts),
        };
      if (r.next_offset === offset) throw Error("Repeated custody cursor");
      offset = r.next_offset;
    }
    throw Error("Custody page limit exceeded");
  }
}
