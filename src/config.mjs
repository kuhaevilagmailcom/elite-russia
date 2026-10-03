export const GAME={
  name:'USERNAME',
  version:'3.0.1',
  startBalance:6000,
  freeDrops:1,
  dropCost:3000,
  maxCollection:100,
  premiumMaxCollection:250,
  showcaseSlots:3,
  premiumShowcaseSlots:6,
  marketFee:0.05,
  seasonDays:30,
  dropRateLimitMs:900,
  wheelCooldownMs:86400000,
  dayTimezoneOffsetMinutes:300,
  systemSellRate:0.18,
  storyTtlMs:86400000
};
export const RARITIES=['COMMON','RARE','EPIC','LEGEND','ULTRA'];
export const RARITY_WEIGHTS={COMMON:91,RARE:7.8,EPIC:1.05,LEGEND:.14,ULTRA:.01};
export const RARITY_BASE={
  COMMON:[500,15000],
  RARE:[15000,100000],
  EPIC:[100000,500000],
  LEGEND:[500000,3000000],
  ULTRA:[3000000,25000000]
};
export const DROP_TIERS=Object.freeze({
  basic:{key:'basic',label:'$3K',cost:3000,weights:{COMMON:94,RARE:5.5,EPIC:.48,LEGEND:.019,ULTRA:.001}},
  boosted:{key:'boosted',label:'$15K',cost:15000,weights:{COMMON:88,RARE:10.5,EPIC:1.4,LEGEND:.095,ULTRA:.005}},
  strong:{key:'strong',label:'$75K',cost:75000,weights:{COMMON:78,RARE:18,EPIC:3.6,LEGEND:.38,ULTRA:.02}},
  max:{key:'max',label:'$300K',cost:300000,weights:{COMMON:68,RARE:24,EPIC:6.8,LEGEND:1.1,ULTRA:.1}}
});
