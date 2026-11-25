import {giftAppearance} from "./gift-appearance.mjs";
// Personal Telegram inventory references. Never insert into tradable gifts or credit a balance.
export function giftSlug(value) {
  if (typeof value !== "string" || value.length > 240) throw Error("Некорректная ссылка");
  const match = /^https:\/\/t\.me\/nft\/([A-Za-z0-9_-]{1,110}-[1-9][0-9]{0,11})\/?$/i.exec(value.trim());
  if (!match) throw Error("Вставьте ссылку https://t.me/nft/Название-123");
  return match[1];
}
export async function findUserGifts(api, user, slugs) {
  const wanted=new Set(slugs),found=new Map();
  if(!wanted.size)return found;
  const userId = Number(user);
  if (!/^[1-9][0-9]*$/.test(String(user)) || !Number.isSafeInteger(userId)) throw Error("Требуется Telegram-аккаунт");
  const seen = new Set();
  let offset;
  for (let page = 0; page < 25; page++) {
    const r = await api.call("getUserGifts", {
      user_id: userId, exclude_unlimited: true, exclude_limited_upgradable: true,
      exclude_limited_non_upgradable: true, exclude_from_blockchain: true,
      limit: 100, ...(offset ? {offset} : {})
    });
    if (!Array.isArray(r?.gifts)) throw Error("Не удалось проверить подарки Telegram");
    for(const match of r.gifts){
      const slug=match.gift?.name;
      if(match.type!=="unique"||!wanted.has(slug)||match.gift.is_burned||match.gift.is_from_blockchain)continue;
      const g = match.gift;
      if (!g.base_name || !Number.isSafeInteger(g.number) || g.number < 1) throw Error("Некорректные данные Telegram");
      const sticker = g.model?.sticker;
      const video = sticker?.is_video === true && sticker?.is_animated !== true ? sticker.file_id : null;
      const animation=sticker?.is_animated===true?sticker.file_id:null;
      const thumb = sticker?.thumbnail?.file_id;
      const file = thumb || (!g.model?.sticker?.is_animated && !g.model?.sticker?.is_video ? g.model?.sticker?.file_id : null);
      found.set(slug,{slug, collection:g.base_name, number:g.number, model:g.model?.name,
        backdrop:g.backdrop?.name, symbol:g.symbol?.name,
        modelMediaUrl:file ? "/api/v1/media/telegram/"+encodeURIComponent(file) : null,
        modelVideoUrl:video ? "/api/v1/media/telegram/"+encodeURIComponent(video) : null,
        modelAnimationUrl:animation ? "/api/v1/media/telegram/"+encodeURIComponent(animation) : null,
        ...giftAppearance(g),mediaVersion:3,
        checkedAt:Date.now(), status:"observed", tradable:false});
      wanted.delete(slug);
    }
    if (!wanted.size || !r.next_offset) return found;
    if (typeof r.next_offset !== "string" || seen.has(r.next_offset)) throw Error("Ошибка пагинации Telegram");
    offset = r.next_offset; seen.add(offset);
  }
  throw Error("Слишком много подарков: проверка не завершена");
}
export async function findUserGift(api,user,slug){return (await findUserGifts(api,user,[slug])).get(slug)||null;}
export class PersonalGifts {
  constructor(repo, api) { this.repo=repo; this.api=api; }
  async initialize() {
    await this.repo.exec("CREATE TABLE IF NOT EXISTS personal_gift_refs (user_id TEXT NOT NULL, slug TEXT NOT NULL, payload TEXT NOT NULL, checked BIGINT NOT NULL, PRIMARY KEY(user_id,slug))");
  }
  async add(user, link) {
    const slug=giftSlug(link);
    const item=await findUserGift(this.api,user,slug);
    if (!item) throw Error("Подарок не найден среди доступных подарков вашего Telegram. Чужой, скрытый или on-chain подарок импортировать нельзя.");
    await this.repo.tx(async()=>{
      const old=await this.repo.get("SELECT slug FROM personal_gift_refs WHERE user_id=? AND slug=?",user,slug);
      if (!old && (await this.repo.all("SELECT slug FROM personal_gift_refs WHERE user_id=? LIMIT 100",user)).length>=100) throw Error("Лимит 100 импортированных подарков");
      await this.repo.run("INSERT INTO personal_gift_refs VALUES (?,?,?,?) ON CONFLICT(user_id,slug) DO UPDATE SET payload=excluded.payload,checked=excluded.checked",user,slug,JSON.stringify(item),item.checkedAt);
    });
    return item;
  }
  async list(user) {
    const rows=await this.repo.all("SELECT payload FROM personal_gift_refs WHERE user_id=? ORDER BY checked DESC LIMIT 100",user);
    return rows.map(x=>({...JSON.parse(x.payload),status:"observed",tradable:false}));
  }
  async refreshMedia(user){
    const old=(await this.list(user)).filter(x=>x.mediaVersion!==3);
    if(!old.length)return {updated:0};
    const found=await findUserGifts(this.api,user,old.map(x=>x.slug));
    await this.repo.tx(async()=>{for(const [slug,item] of found)await this.repo.run("UPDATE personal_gift_refs SET payload=?,checked=? WHERE user_id=? AND slug=?",JSON.stringify(item),item.checkedAt,user,slug);});
    return {updated:found.size};
  }
  async remove(user,slug) {
    await this.repo.run("DELETE FROM personal_gift_refs WHERE user_id=? AND slug=?",user,slug);
    return {ok:true};
  }
}
