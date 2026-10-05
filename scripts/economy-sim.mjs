import {DROP_TIERS,RARITIES} from '../src/config.mjs';
import {SPECIALS,buildGeneratedHandle,isValidHandle,scoreHandle,rarityFromValue} from '../src/generator.mjs';
import {systemSellValue} from '../src/economy.mjs';

function rngFactory(seed=0x13579bdf){
  let x=seed>>>0;
  return ()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/0x100000000};
}
function pickProfile(tier,rng){
  const x=rng()*100;let sum=0;
  for(const p of RARITIES){sum+=Number(tier.weights[p]||0);if(x<sum)return p}
  return 'COMMON';
}
function percentile(sorted,p){return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))]||0}
function starterDropValue(rawValue){const scaled=Math.round((Math.max(200,Number(rawValue)||200)/20)/50)*50;return Math.max(400,Math.min(3500,scaled))}
function simulateTier(tier,samples,seed){
  const rng=rngFactory(seed),used=new Set(),specials=SPECIALS.map(x=>({handle:x[0],rarity:x[1],value:Number(x[2])}));
  let sumValue=0,sumSell=0,breakEven=0,len4=0,len5=0;
  const rarities=Object.fromEntries(RARITIES.map(x=>[x,0])),values=[];
  for(let n=0;n<samples;n++){
    const starter=tier.key==='basic',profile=starter?'COMMON':pickProfile(tier,rng),specialChance=starter?0:({COMMON:.002,RARE:.012,EPIC:.05,LEGEND:.18,ULTRA:.55}[profile]||0);
    let handle='',value=0;
    if(rng()<specialChance){
      const available=specials.filter(x=>x.rarity===profile&&!used.has(x.handle));
      if(available.length){const sp=available[Math.floor(rng()*available.length)];handle=sp.handle;value=sp.value}
    }
    if(!handle){
      for(let i=0;i<250;i++){
        const candidate=buildGeneratedHandle(profile,rng);
        if(!isValidHandle(candidate)||used.has(candidate))continue;
        handle=candidate;value=scoreHandle(handle,'COMMON',1,1,rng);if(starter)value=starterDropValue(value);break;
      }
    }
    if(!handle)continue;
    used.add(handle);
    const rarity=rarityFromValue(value),sell=systemSellValue(value);
    sumValue+=value;sumSell+=sell;values.push(value);rarities[rarity]++;
    if(sell>=tier.cost)breakEven++;
    if(handle.length===4)len4++;
    if(handle.length===5)len5++;
  }
  values.sort((a,b)=>a-b);
  const actual=values.length||1;
  return {
    tier:tier.key,samples:actual,cost:tier.cost,
    avgValue:Math.round(sumValue/actual),avgSell:Math.round(sumSell/actual),
    sellBreakEvenRate:Number((breakEven/actual).toFixed(6)),
    fourCharRate:Number((len4/actual).toFixed(6)),fiveCharRate:Number((len5/actual).toFixed(6)),
    rarityDistribution:Object.fromEntries(RARITIES.map(x=>[x,Number((rarities[x]/actual).toFixed(6))])),
    p95:percentile(values,.95),p99:percentile(values,.99),max:values.at(-1)||0,
    uniqueHandles:used.size
  };
}
const perTier=Math.max(25000,Number(process.argv[2]||100000)),report=[];
let seed=0x12345678;
for(const tier of Object.values(DROP_TIERS)){const row=simulateTier(tier,perTier,seed++);report.push(row)}
console.log(JSON.stringify({generatedAt:new Date().toISOString(),perTier,totalSamples:report.reduce((s,x)=>s+x.samples,0),specialsAreFiniteUnique:true,tiers:report},null,2));
const bad=report.filter(x=>x.avgSell>=x.cost);
if(bad.length){console.error('Economy EV check failed:',bad.map(x=>x.tier).join(','));process.exit(1)}
if(report.some(x=>x.fourCharRate>.001)){console.error('4-char jackpot frequency too high');process.exit(1)}
