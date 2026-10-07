export const GAME={
  name:'USERNAME',
  version:'7.4.0',
  startBalance:50000,
  freeDrops:1,
  dropCost:3000,
  maxCollection:100,
  premiumMaxCollection:250,
  marketFee:0.05,
  transferFee:0.05,
  seasonDays:30,
  dropRateLimitMs:900,
  wheelCooldownMs:86400000,
  dayTimezoneOffsetMinutes:300,
  storyTtlMs:86400000
};

export const USERNAME_RULES=Object.freeze({
  minLength:4,
  maxLength:15,
  pattern:'^[a-z][a-z0-9_]{3,14}$'
});

export const RARITIES=['COMMON','RARE','EPIC','LEGEND','ULTRA'];
export const RARITY_WEIGHTS={COMMON:91,RARE:7.8,EPIC:1.05,LEGEND:.14,ULTRA:.01};

export const STARTER_DROP_JACKPOT=Object.freeze({
  rareChance:.004,
  bigChance:.0005,
  ultraChance:.00001,
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
  basic:{key:'basic',label:'3K',cost:3000,weights:{COMMON:94,RARE:5.5,EPIC:.48,LEGEND:.019,ULTRA:.001}},
  boosted:{key:'boosted',label:'15K',cost:15000,weights:{COMMON:88.5,RARE:9.5,EPIC:1.8,LEGEND:.19,ULTRA:.01}},
  strong:{key:'strong',label:'50K',cost:50000,weights:{COMMON:68,RARE:20,EPIC:9,LEGEND:2.9,ULTRA:.1}},
  max:{key:'max',label:'100K',cost:100000,weights:{COMMON:55,RARE:24,EPIC:15,LEGEND:5.8,ULTRA:.2}}
});
