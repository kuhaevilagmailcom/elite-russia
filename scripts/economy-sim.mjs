import {DROP_TIERS,RARITIES,STARTER_DROP_JACKPOT} from '../src/config.mjs';
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
function starterBand(mode){
  if(mode==='rare')return [STARTER_DROP_JACKPOT.rareMin,STARTER_DROP_JACKPOT.rareMax];
  if(mode==='big')return [STARTER_DROP_JACKPOT.bigMin,STARTER_DROP_JACKPOT.bigMax];
  if(mode==='ultra')return [STARTER_DROP_JACKPOT.ultraMin,Number.MAX_SAFE_INTEGER];
  return [STARTER_DROP_JACKPOT.normalMin,STARTER_DROP_JACKPOT.normalMax];
}
function starterMode(rng){
  const r=rng(),u=STARTER_DROP_JACKPOT.ultraChance,b=u+STARTER_DROP_JACKPOT.bigChance,rr=b+STARTER_DROP_JACKPOT.rareChance;
  return r<u?'ultra':r<b?'big':r<rr?'rare':'normal';
}
function simulateTier(tier,samples,seed){
  const rng=rngFactory(seed),used=new Set(),specials=SPECIALS.map(x=>({handle:x[0],rarity:x[1],value:Number(x[2])}));
  let sumValue=0,sumSell=0,breakEven=0,len4=0,len5=0;
  const rarities=Object.fromEntries(RARITIES.map(x=>[x,0])),values=[];
  for(let n=0;n<samples;n++){
    const starter=tier.key==='basic',mode=starter?starterMode(rng):null,profile=starter?(mode==='ultra'?'ULTRA':mode==='big'||mode==='rare'?'RARE':'COMMON'):pickProfile(tier,rng);
    const specialChance=starter?0:({COMMON:.002,RARE:.012,EPIC:.05,LEGEND:.18,ULTRA:.55}[profile]||0);
    let handle='',value=0;
    if(starter&&(mode==='ultra'||mode==='big')){
      const min=mode==='ultra'?STARTER_DROP_JACKPOT.ultraMin:STARTER_DROP_JACKPOT.bigMin;
      const max=mode==='ultra'?Number.MAX_SAFE_INTEGER:STARTER_DROP_JACKPOT.bigMax;
      const available=specials.filter(x=>x.value>=min&&x.value<=max&&!used.has(x.handle));
      if(available.length){const sp=available[Math.floor(rng()*available.length)];handle=sp.handle;value=sp.value}
    }else if(rng()<specialChance){
      const available=specials.filter(x=>x.rarity===profile&&!used.has(x.handle));
      if(available.length){const sp=available[Math.floor(rng()*available.length)];handle=sp.handle;value=sp.value}
    }
    if(!handle){
      const band=starter?starterBand(mode):null;
      for(let i=0;i<(starter?650:250);i++){
        const candidate=buildGeneratedHandle(profile,rng);
        if(!isValidHandle(candidate)||used.has(candidate))continue;
        const candidateValue=scoreHandle(candidate,'COMMON',1,1,rng);
        if(starter&&(candidateValue<band[0]||candidateValue>band[1]))continue;
        handle=candidate;value=candidateValue;break;
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
const fourCharCaps={basic:.001,boosted:.003,strong:.01,max:.02};
const shortNameOutliers=report.filter(x=>x.fourCharRate>Number(fourCharCaps[x.tier]??.02));
if(shortNameOutliers.length){
  console.error('4-char jackpot frequency too high:',shortNameOutliers.map(x=>x.tier+'='+x.fourCharRate).join(','));
  process.exit(1);
}
