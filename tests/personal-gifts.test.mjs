import test from "node:test";
import assert from "node:assert/strict";
import {giftSlug,findUserGift,PersonalGifts} from "../packages/personal-gifts.mjs";
import {SQLiteRepository} from "../packages/database/repository.mjs";
const slug="PlushPepe-123", link="https://t.me/nft/"+slug;
const gift={type:"unique",gift:{name:slug,base_name:"Plush Pepe",number:123,model:{name:"Test",sticker:{thumbnail:{file_id:"image"}}}}};
test("strict Telegram NFT URL",()=>{
  assert.equal(giftSlug(link),slug);
  for(const bad of ["https://evil.example/nft/"+slug,"https://t.me.evil/nft/"+slug,"https://t.me/nft/"+slug+"?x=1","http://t.me/nft/"+slug,"https://t.me/nft/../"+slug]) assert.throws(()=>giftSlug(bad));
});
test("only gifts of authenticated user, pagination and nontradable result",async()=>{
  let n=0;
  const api={call:async(method,p)=>{assert.equal(method,"getUserGifts");assert.equal(p.user_id,123);return ++n===1?{gifts:[],next_offset:"next"}:{gifts:[gift]};}};
  const result=await findUserGift(api,"123",slug);
  assert.equal(result.tradable,false);assert.equal(result.slug,slug);assert.equal(n,2);
  assert.equal(await findUserGift({call:async()=>({gifts:[]})},"123",slug),null);
  await assert.rejects(()=>findUserGift(api,"demo",slug));
});
test("private references are isolated, deduplicated and never create market assets",async()=>{
  const repo=await SQLiteRepository.open();
  try{
    const store=new PersonalGifts(repo,{call:async(_m,p)=>({gifts:p.user_id===123?[gift]:[]})});
    await store.initialize();await store.add("123",link);await store.add("123",link);
    assert.equal((await store.list("123")).length,1);
    assert.equal((await store.list("456")).length,0);
    await assert.rejects(()=>store.add("456",link));
    assert.equal((await repo.all("SELECT * FROM gifts")).length,0);
    await store.remove("456",slug);assert.equal((await store.list("123")).length,1);
    await store.remove("123",slug);assert.equal((await store.list("123")).length,0);
  }finally{await repo.close();}
});

test("original video sticker and thumbnail remain nontradable references",async()=>{
 const videoGift=structuredClone(gift);videoGift.gift.model.sticker={is_video:true,file_id:"video123",thumbnail:{file_id:"image123"}};
 const item=await findUserGift({call:async()=>({gifts:[videoGift]})},"123",slug);
 assert.equal(item.modelVideoUrl,"/api/v1/media/telegram/video123");assert.equal(item.modelMediaUrl,"/api/v1/media/telegram/image123");assert.equal(item.tradable,false);
 videoGift.gift.model.sticker.is_video=false;videoGift.gift.model.sticker.is_animated=true;
 const animated=await findUserGift({call:async()=>({gifts:[videoGift]})},"123",slug);assert.equal(animated.modelVideoUrl,null);assert.equal(animated.modelAnimationUrl,"/api/v1/media/telegram/video123");assert.equal(animated.mediaVersion,4);
});

test("legacy media refresh only updates existing owned gift references",async()=>{const repo=await SQLiteRepository.open();try{const animated=structuredClone(gift);animated.gift.model.sticker={is_animated:true,file_id:"animation123",thumbnail:{file_id:"image123"}};let count=0;const store=new PersonalGifts(repo,{call:async()=>{count++;return {gifts:[animated]}}});await store.initialize();await repo.run("INSERT INTO personal_gift_refs VALUES (?,?,?,?)","123",slug,JSON.stringify({slug,mediaVersion:1}),1);assert.deepEqual(await store.refreshMedia("456"),{updated:0});assert.deepEqual(await store.refreshMedia("123"),{updated:1});assert.equal((await store.list("123"))[0].modelAnimationUrl,"/api/v1/media/telegram/animation123");assert.equal(count,1);assert.deepEqual(await store.refreshMedia("123"),{updated:0});}finally{await repo.close();}});

test("original Telegram background colors and symbol mask survive import",async()=>{const item=structuredClone(gift);item.gift.backdrop={name:"Blue",colors:{center_color:0x71abef,edge_color:0x274486,symbol_color:0x4969a6,text_color:0xffffff}};item.gift.symbol={name:"Star",sticker:{is_animated:true,file_id:"tgs123",thumbnail:{file_id:"pattern123"}}};const result=await findUserGift({call:async()=>({gifts:[item]})},"123",slug);assert.deepEqual(result.backdropColors,{center:0x71abef,edge:0x274486,symbol:0x4969a6,text:0xffffff});assert.equal(result.symbolMediaUrl,"/api/v1/media/telegram/pattern123");assert.equal(result.tradable,false);});

test("personal gift rarity is original per mille metadata, unknown is null",async()=>{const g=structuredClone(gift);g.gift.model.rarity_per_mille=15;g.gift.symbol={rarity_per_mille:1001};const result=await findUserGift({call:async()=>({gifts:[g]})},"123",slug);assert.equal(result.modelRarity,15);assert.equal(result.symbolRarity,null);assert.equal(result.backdropRarity,null);assert.equal(result.tradable,false);});

test("batch refresh is scoped, deduplicated, and does not equate missing with loss of ownership",async()=>{
 const repo=await SQLiteRepository.open();try{
 let gifts=[gift],calls=0;const store=new PersonalGifts(repo,{call:async()=>{calls++;return {gifts}}});await store.initialize();await store.add("123",link);await store.add("456",link);const before=(await store.list("123"))[0].checkedAt;
 gifts=[];calls=0;assert.deepEqual(await store.batch("123","refresh",[slug,slug,"Other-456"]),{observed:0,notObserved:1,skipped:1});assert.equal(calls,1);
 let item=(await store.list("123"))[0];assert.equal(item.status,"not_observed");assert.equal(item.checkedAt,before);assert.equal(item.tradable,false);assert.equal((await store.list("456"))[0].status,"observed");
 gifts=[gift];assert.deepEqual(await store.batch("123","refresh",[slug]),{observed:1,notObserved:0,skipped:0});assert.equal((await store.list("123"))[0].status,"observed");
 store.api={call:async()=>{throw Error("network")}};const snapshot=await store.list("123");await assert.rejects(()=>store.batch("123","refresh",[slug]));assert.deepEqual(await store.list("123"),snapshot);
 await assert.rejects(()=>store.batch("123","remove",[slug,"../bad"]));assert.deepEqual(await store.list("123"),snapshot);
 assert.deepEqual(await store.batch("123","remove",[slug,slug,"Other-456"]),{removed:1,skipped:1});assert.equal((await store.list("456")).length,1);assert.equal((await repo.all("SELECT * FROM gifts")).length,0);
 }finally{await repo.close();}
});

test("legacy media refresh cannot overwrite a newer check or count a removed reference",async()=>{
 const repo=await SQLiteRepository.open();try{
  let release,started;const gate=new Promise(r=>{release=r});const entered=new Promise(r=>{started=r});
  const store=new PersonalGifts(repo,{call:async()=>{started();await gate;return {gifts:[gift]}}});
  await store.initialize();
  const legacy=JSON.stringify({slug,mediaVersion:1,checkedAt:1});
  await repo.run("INSERT INTO personal_gift_refs VALUES (?,?,?,?)","123",slug,legacy,1);
  const pending=store.refreshMedia("123");await entered;
  const newer=JSON.stringify({slug,mediaVersion:4,checkedAt:2,status:"not_observed",lastAttempt:3});
  await repo.run("UPDATE personal_gift_refs SET payload=?,checked=? WHERE user_id=? AND slug=?",newer,2,"123",slug);
  release();assert.deepEqual(await pending,{updated:0});
  assert.equal((await store.list("123"))[0].status,"not_observed");
  await repo.run("UPDATE personal_gift_refs SET payload=?,checked=? WHERE user_id=? AND slug=?",legacy,1,"123",slug);
  let resume,begin;const waiting=new Promise(r=>{resume=r});const ready=new Promise(r=>{begin=r});
  store.api={call:async()=>{begin();await waiting;return {gifts:[gift]}}};
  const second=store.refreshMedia("123");await ready;await store.remove("123",slug);resume();
  assert.deepEqual(await second,{updated:0});assert.deepEqual(await store.list("123"),[]);
 }finally{await repo.close();}
});
