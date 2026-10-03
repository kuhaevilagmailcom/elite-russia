import crypto from 'node:crypto';
import {RARITY_WEIGHTS,RARITY_BASE} from './config.mjs';
import {randomUnit} from './economy.mjs';

export const ROOTS=[
'card','loly','mama','sigma','love','dream','angel','baby','cool','club','news','music','bank','shop','monk','ghost','void','vision','legend','dealer','storm','night','phantom','million','master','mister','king','prime','rocket','shadow','venom','savage','black','white','wolf','tiger','moon','solar','street','drive','speed','turbo','money','rich','diamond','silver','rare','zero','pixel','cloud','wave','nova','silent','unknown','anonymous','alpha','omega','orbit','pulse','frame','motion','vector','signal','matrix','vertex','binary','cipher','static','future','chrome','carbon','graphite','velvet','royal','elite','major','minor','urban','metro','avenue','district','tower','garage','motor','rider','pilot','racer','drift','boost','nitro','gtr','amg','bmw','mclaren','porsche','supra','skyline','viper','cobra','falcon','hawk','raven','lion','panther','shark','orca','fox','bear','eagle','falcon','hunter','chief','boss','owner','founder','leader','winner','champion','hero','icon','famous','classic','vintage','rarely','simple','basic','clean','mono','blank','pure','clear','sharp','swift','quick','rapid','sonic','flash','light','bright','dark','midnight','sunset','dawn','winter','summer','north','south','west','east','ocean','river','stone','steel','iron','gold','platinum','onyx','jade','ruby','sapphire','emerald','luxury','premium','status','credit','cash','market','trade','stock','vault','bank','mint','coin','profit','wealth','capital','business','studio','media','music','audio','beat','bass','vibe','mood','style','fashion','model','design','art','photo','film','camera','scene','screen','game','player','level','score','rank','top','arena','clutch','skill','aim','quest','party','lobby','server','online','digital','cyber','logic','code','byte','data','node','core','link','network','system','device','mobile','phone','apple','telegram','social','viral','trend','daily','global','world','planet','space','cosmos','astro','mars','lunar','star','comet','galaxy','neonless','mystic','secret','hidden','private','public','real','true','only','first','last','young','old','modern','retro','smart','wild','calm','cold','hot','high','low','big','small','great','super','hyper','ultra','max','pro','one','seven','sevenfold','mistery','noble','monarch','duke','baron','saint','ace','zen','echo','flux','frost','blaze','ember','mist','rain','snow','thunder','volt','wavey','crisp','solid','fluid','orbitz','stark','roman','atlas','apollo','mercury','saturn','jupiter','venus','pluto','delta','sigma','lambda','kappa','omegaone','northstar','daylight','nightfall','blackout','whiteout','overdrive','redline','pitlane','roadster','coupe','sedan','touring','classiccar','motors','driver','streetcar','fastlane','highway','cityline','skyway','airline','railway','terminal','station','central','uptown','downtown','midtown','brook','park','garden','forest','valley','mountain','island','harbor','port','bay','coast','beach','desert','canyon','cliff','peak','summit','ridge','field','meadow','green','blue','red','orange','purple','gray','grey','ivory','obsidian','crystal','marble','granite','wood','paper','glass','metal','titanium','cobalt','nickel','copper','bronze','brass'
];
export const SUFFIXES=['','7','77','777','1','01','07','007','x','xx','pro','one','max','hq','live','lab','io','tv','club','zone','hub','net','go'];
export const PREFIXES=['','the','real','mr','its','iam'];

export const SPECIALS=[
  ['card','ULTRA',15000000,1,'short_word'],
  ['mama','ULTRA',12000000,1,'short_word'],
  ['monk','ULTRA',10000000,1,'short_word'],
  ['void','ULTRA',9000000,1,'short_word'],
  ['loly','ULTRA',6000000,1,'short_word'],
  ['sigma','ULTRA',2200000,1,'word'],
  ['ghost','ULTRA',1800000,1,'word'],
  ['prime','LEGEND',1500000,1,'word'],
  ['storm','LEGEND',1100000,1,'word'],
  ['vision','LEGEND',950000,1,'word'],
  ['mister','LEGEND',900000,1,'word'],
  ['legend','LEGEND',850000,1,'word'],
  ['dealer','LEGEND',700000,1,'word'],
  ['million','LEGEND',650000,1,'word'],
  ['phantom','LEGEND',600000,1,'word'],
  ['mister777','EPIC',220000,1,'pattern'],
  ['ghost77','EPIC',160000,1,'pattern'],
  ['king777','EPIC',130000,1,'pattern'],
  ['master7','EPIC',110000,1,'pattern'],
  ['blackout','EPIC',90000,1,'word'],
  ['venom77','RARE',70000,1,'pattern'],
  ['gtr77','RARE',55000,1,'pattern'],
  ['amg77','RARE',55000,1,'pattern'],
  ['m5pro','RARE',35000,1,'pattern']
]

export function hasLetter(handle){return /[a-z]/i.test(String(handle||''))}
export function isValidHandle(handle){return /^[a-z][a-z0-9_]{3,9}$/i.test(String(handle||''))&&hasLetter(handle)}
export function randInt(min,max){return crypto.randomInt(min,max+1)}
export function choice(arr){return arr[crypto.randomInt(0,arr.length)]}

export function weightedRarity(rng=randomUnit){
  const x=rng()*100;let sum=0;
  for(const r of ['COMMON','RARE','EPIC','LEGEND','ULTRA']){sum+=RARITY_WEIGHTS[r];if(x<sum)return r}
  return 'COMMON';
}
function prettyDigits(){
  const pool=['7','77','777','01','07','007','1','11','21','47','69','88','99'];
  return choice(pool);
}
function randomLetters(min=6,max=10){
  const consonants='bcdfghjklmnpqrstvwxyz',vowels='aeiou';
  const len=randInt(min,max);let s='';
  for(let i=0;i<len;i++)s+=i%2===0?choice(consonants.split('')):choice(vowels.split(''));
  if(randomUnit()<.42){
    const arr=s.split(''),i=randInt(0,arr.length-1);arr[i]=choice(consonants.split(''));s=arr.join('');
  }
  return s;
}
function normalizeGenerated(handle){
  let h=String(handle||'').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,10);
  if(h.length<4)h=(h+'name').slice(0,4);
  if(!hasLetter(h))h='u'+h.slice(0,9);
  return h;
}
function rootForRarity(rarity){
  const range={
    COMMON:[7,10],RARE:[6,9],EPIC:[5,8],LEGEND:[5,7],ULTRA:[4,6]
  }[rarity]||[7,10];
  const pool=ROOTS.filter(x=>x.length>=range[0]&&x.length<=range[1]&&/^[a-z]+$/.test(x));
  return choice(pool.length?pool:ROOTS).slice(0,10);
}
export function buildGeneratedHandle(rarity='COMMON'){
  const root=rootForRarity(rarity);
  const roll=randomUnit();let handle=root;
  if(rarity==='COMMON'){
    if(roll<.28)handle=randomLetters(7,10);
    else if(roll<.55)handle=root;
    else if(roll<.88)handle=root+randInt(1,999);
    else handle=choice(PREFIXES.slice(1))+root;
  }else if(rarity==='RARE'){
    if(roll<.10)handle=randomLetters(6,9);
    else if(roll<.62)handle=root;
    else if(roll<.86)handle=root+prettyDigits();
    else handle=choice(PREFIXES.slice(0,3))+root;
  }else if(rarity==='EPIC'){
    handle=roll<.78?root:(roll<.94?root+choice(['7','77','x']):choice(PREFIXES.slice(0,3))+root);
  }else if(rarity==='LEGEND'){
    handle=roll<.93?root:root+choice(['7','x']);
  }else{
    // Only ULTRA can naturally generate 4-character handles.
    handle=root;
  }
  return normalizeGenerated(handle);
}
const WORD_SET=new Set(ROOTS.map(x=>String(x).toLowerCase()).filter(x=>/^[a-z]{3,10}$/.test(x)));
export function wordQuality(handle){
  const h=String(handle||'').toLowerCase();
  const letters=h.replace(/[^a-z]/g,'');
  if(WORD_SET.has(h))return 1;
  if(WORD_SET.has(letters)&&/^[a-z]+\d{1,3}$/.test(h))return .72;
  if(WORD_SET.has(letters))return .62;
  const vowelRatio=(letters.match(/[aeiou]/g)||[]).length/Math.max(1,letters.length);
  const ugly=/[bcdfghjklmnpqrstvwxyz]{4,}|[aeiou]{4,}/.test(letters);
  if(!ugly&&vowelRatio>=.25&&vowelRatio<=.6)return .42;
  return .22;
}
function lengthWordBase(len){
  return ({4:8000000,5:1200000,6:350000,7:150000,8:70000,9:35000,10:18000})[len]||12000;
}
function scoreCore(handle,rarity='COMMON',instanceNumber=1,maxSupply=1,jitter=.0){
  const h=String(handle).toLowerCase();
  const len=h.length,quality=wordQuality(h),base=lengthWordBase(len);
  let qualityFactor=quality>=1?1:quality>=.7?.45:quality>=.6?.30:quality>=.4?.16:.075;
  let score=base*qualityFactor;
  const rarityFactor={COMMON:.72,RARE:1,EPIC:1.3,LEGEND:1.7,ULTRA:2.35}[rarity]||1;
  score*=rarityFactor;
  if(/_/.test(h))score*=.48;
  if(/\d/.test(h)){
    score*=.58;
    if(/777$/.test(h))score*=1.28;
    else if(/77$/.test(h))score*=1.16;
    else if(/007$/.test(h))score*=1.12;
    else if(/(\d)\1{1,}$/.test(h))score*=1.08;
  }else score*=1.08;
  // 4-character handles are a separate scarcity class.
  if(len===4)score*=1.35;
  return Math.max(200,Math.round(score*(1+jitter)/100)*100);
}
export function scoreHandle(handle,rarity='COMMON',instanceNumber=1,maxSupply=1,rng=randomUnit){
  return scoreCore(handle,rarity,1,1,(rng()-.5)*.08);
}
export function stableScoreHandle(handle,rarity='COMMON',instanceNumber=1,maxSupply=1){
  const key=`${String(handle).toLowerCase()}:${rarity}:unique-v3`;
  const h=crypto.createHash('sha256').update(key).digest();
  const unit=h.readUInt32BE(0)/0xffffffff;
  return scoreCore(handle,rarity,1,1,(unit-.5)*.08);
}
export function generatedSupply(){return 1}
export function candidateUniverseSize(){return ROOTS.length*SUFFIXES.length+ROOTS.length*(PREFIXES.length-1)}
