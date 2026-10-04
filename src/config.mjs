export const GAME={
  name:'USERNAME',
  version:'4.9.0',
  startBalance:50000,
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
  storyTtlMs:86400000
};
export const RARITIES=['COMMON','RARE','EPIC','LEGEND','ULTRA'];
export const RARITY_WEIGHTS={COMMON:91,RARE:7.8,EPIC:1.05,LEGEND:.14,ULTRA:.01};
export const RARITY_BASE={
  COMMON:[200,14999],
  RARE:[15000,99999],
  EPIC:[100000,499999],
  LEGEND:[500000,1999999],
  ULTRA:[2000000,25000000]
};
export const DROP_TIERS=Object.freeze({
  basic:{key:'basic',label:'$3K',cost:3000,weights:{COMMON:94,RARE:5.5,EPIC:.48,LEGEND:.019,ULTRA:.001}},
  boosted:{key:'boosted',label:'$15K',cost:15000,weights:{COMMON:72,RARE:22,EPIC:5.25,LEGEND:.745,ULTRA:.005}},
  strong:{key:'strong',label:'$75K',cost:75000,weights:{COMMON:48,RARE:32,EPIC:16.4,LEGEND:3.58,ULTRA:.02}},
  max:{key:'max',label:'$300K',cost:300000,weights:{COMMON:32,RARE:33,EPIC:25,LEGEND:9.92,ULTRA:.08}}
});
