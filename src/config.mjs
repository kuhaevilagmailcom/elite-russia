export const GAME={
  name:'USERNAME',
  version:'6.1.1',
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
export const STARTER_DROP_JACKPOT=Object.freeze({
  rareChance:.004,      // 0.40%  ~ 1 in 250
  bigChance:.0005,      // 0.05%  ~ 1 in 2,000
  ultraChance:.00001,   // 0.001% ~ 1 in 100,000
  normalMin:400,normalMax:3500,
  goodMin:3500,goodMax:9000,
  rareMin:9000,rareMax:50000,
  bigMin:50000,bigMax:250000,
  ultraMin:2000000
});
export const RARITY_BASE={
  COMMON:[200,14999],
  RARE:[15000,99999],
  EPIC:[100000,499999],
  LEGEND:[500000,1999999],
  ULTRA:[2000000,100000000]
};
export const DROP_TIERS=Object.freeze({
  basic:{key:'basic',label:'$3K',cost:3000,weights:{COMMON:94,RARE:5.5,EPIC:.48,LEGEND:.019,ULTRA:.001}},
  boosted:{key:'boosted',label:'$55K',cost:55000,weights:{COMMON:72,RARE:22,EPIC:5.25,LEGEND:.745,ULTRA:.005}},
  strong:{key:'strong',label:'$120K',cost:120000,weights:{COMMON:48,RARE:32,EPIC:16.4,LEGEND:3.58,ULTRA:.02}},
  max:{key:'max',label:'$300K',cost:300000,weights:{COMMON:32,RARE:33,EPIC:25,LEGEND:9.92,ULTRA:.08}}
});
