export const GAME={
  name:'USERNAME',
  version:'2.1.0',
  startBalance:10000,
  freeDrops:3,
  dropCost:2000,
  maxCollection:120,
  premiumMaxCollection:300,
  showcaseSlots:3,
  premiumShowcaseSlots:6,
  marketFee:0.05,
  seasonDays:30,
  dropRateLimitMs:900,
  wheelCooldownMs:86400000
};
export const RARITIES=['COMMON','RARE','EPIC','LEGEND','ULTRA'];
export const RARITY_WEIGHTS={COMMON:78,RARE:18.5,EPIC:3,LEGEND:.45,ULTRA:.05};
export const RARITY_BASE={COMMON:[350,1700],RARE:[2600,9500],EPIC:[16000,65000],LEGEND:[180000,1200000],ULTRA:[3500000,15000000]};
export const DROP_TIERS=Object.freeze({
  basic:{key:'basic',label:'2K',cost:2000,weights:{COMMON:88,RARE:10.5,EPIC:1.35,LEGEND:.14,ULTRA:.01}},
  boosted:{key:'boosted',label:'8K',cost:8000,weights:{COMMON:76,RARE:20,EPIC:3.6,LEGEND:.37,ULTRA:.03}},
  strong:{key:'strong',label:'35K',cost:35000,weights:{COMMON:62,RARE:27,EPIC:9.5,LEGEND:1.4,ULTRA:.1}},
  max:{key:'max',label:'100K',cost:100000,weights:{COMMON:52,RARE:31,EPIC:13.5,LEGEND:3.2,ULTRA:.3}}
});
