import crypto from 'node:crypto';
import {RARITY_WEIGHTS,RARITY_BASE} from './config.mjs';

export const ROOTS=[
'monk','ghost','void','vision','legend','dealer','storm','night','phantom','million','master','mister','king','prime','rocket','shadow','venom','savage','black','white','wolf','tiger','moon','solar','street','drive','speed','turbo','money','rich','diamond','silver','rare','zero','pixel','cloud','wave','nova','silent','unknown','anonymous','alpha','omega','orbit','pulse','frame','motion','vector','signal','matrix','vertex','binary','cipher','static','future','chrome','carbon','graphite','velvet','royal','elite','major','minor','urban','metro','avenue','district','tower','garage','motor','rider','pilot','racer','drift','boost','nitro','gtr','amg','bmw','mclaren','porsche','supra','skyline','viper','cobra','falcon','hawk','raven','lion','panther','shark','orca','fox','bear','eagle','falcon','hunter','chief','boss','owner','founder','leader','winner','champion','hero','icon','famous','classic','vintage','rarely','simple','basic','clean','mono','blank','pure','clear','sharp','swift','quick','rapid','sonic','flash','light','bright','dark','midnight','sunset','dawn','winter','summer','north','south','west','east','ocean','river','stone','steel','iron','gold','platinum','onyx','jade','ruby','sapphire','emerald','luxury','premium','status','credit','cash','market','trade','stock','vault','bank','mint','coin','profit','wealth','capital','business','studio','media','music','audio','beat','bass','vibe','mood','style','fashion','model','design','art','photo','film','camera','scene','screen','game','player','level','score','rank','top','arena','clutch','skill','aim','quest','party','lobby','server','online','digital','cyber','logic','code','byte','data','node','core','link','network','system','device','mobile','phone','apple','telegram','social','viral','trend','daily','global','world','planet','space','cosmos','astro','mars','lunar','star','comet','galaxy','neonless','mystic','secret','hidden','private','public','real','true','only','first','last','young','old','modern','retro','smart','wild','calm','cold','hot','high','low','big','small','great','super','hyper','ultra','max','pro','one','seven','sevenfold','mistery','noble','monarch','duke','baron','saint','ace','zen','echo','flux','frost','blaze','ember','mist','rain','snow','thunder','volt','wavey','crisp','solid','fluid','orbitz','stark','roman','atlas','apollo','mercury','saturn','jupiter','venus','pluto','delta','sigma','lambda','kappa','omegaone','northstar','daylight','nightfall','blackout','whiteout','overdrive','redline','pitlane','roadster','coupe','sedan','touring','classiccar','motors','driver','streetcar','fastlane','highway','cityline','skyway','airline','railway','terminal','station','central','uptown','downtown','midtown','brook','park','garden','forest','valley','mountain','island','harbor','port','bay','coast','beach','desert','canyon','cliff','peak','summit','ridge','field','meadow','green','blue','red','orange','purple','gray','grey','ivory','obsidian','crystal','marble','granite','wood','paper','glass','metal','titanium','cobalt','nickel','copper','bronze','brass'
];
export const SUFFIXES=['','7','77','777','1','01','07','007','x','xx','pro','one','max','hq','live','lab','io','tv','club','zone','hub','net','go'];
export const PREFIXES=['','the','real','mr','its','iam'];

export const SPECIALS=[
  ['monk','ULTRA',14500000,25,'short'],
  ['void','ULTRA',11800000,35,'short'],
  ['ghost','ULTRA',9200000,50,'short'],
  ['legend','LEGEND',1250000,90,'status'],
  ['mister','LEGEND',980000,120,'status'],
  ['vision','LEGEND',820000,140,'word'],
  ['phantom','LEGEND',760000,160,'word'],
  ['million','LEGEND',1100000,100,'money'],
  ['dealer','LEGEND',690000,180,'business'],
  ['storm','LEGEND',640000,180,'word'],
  ['prime','LEGEND',780000,150,'status'],
  ['mister777','LEGEND',1150000,100,'pattern'],
  ['ghost77','EPIC',340000,500,'pattern'],
  ['master7','EPIC',210000,700,'pattern'],
  ['blackout','EPIC',180000,650,'dark'],
  ['king777','EPIC',260000,450,'pattern'],
  ['venom77','EPIC',175000,650,'pattern'],
  ['gtr77','EPIC',150000,700,'cars'],
  ['amg77','EPIC',155000,700,'cars'],
  ['m5pro','RARE',42000,1200,'cars']
];

export function hasLetter(handle){return /[a-z]/i.test(String(handle||''))}
export function isValidHandle(handle){return /^[a-z][a-z0-9_]{2,15}$/i.test(String(handle||''))&&hasLetter(handle)}
export function randInt(min,max){return crypto.randomInt(min,max+1)}
export function choice(arr){return arr[crypto.randomInt(0,arr.length)]}

export function weightedRarity(rng=Math.random){
  const x=rng()*100;let sum=0;
  for(const r of ['COMMON','RARE','EPIC','LEGEND','ULTRA']){sum+=RARITY_WEIGHTS[r];if(x<sum)return r}
  return 'COMMON';
}
function prettyDigits(){
  const pool=['7','77','777','01','07','007','1','11','21','47','69','88','99'];
  return choice(pool);
}
export function buildGeneratedHandle(rarity='COMMON'){
  const root=choice(ROOTS);
  let handle=root;
  if(rarity==='COMMON'){
    if(Math.random()<.82)handle=root+randInt(10,9999);
    else handle=choice(PREFIXES.slice(1))+root+randInt(1,99);
  }else if(rarity==='RARE'){
    handle=Math.random()<.55?root+randInt(1,99):root+prettyDigits();
  }else if(rarity==='EPIC'){
    handle=Math.random()<.7?root+prettyDigits():choice(PREFIXES.slice(0,3))+root;
  }else if(rarity==='LEGEND'){
    handle=Math.random()<.55?root:root+choice(['7','77','777','x']);
  }else{
    handle=root;
  }
  handle=handle.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,16);
  if(handle.length<3)handle=(handle+'pro').slice(0,3);
  if(!hasLetter(handle))handle='u'+handle;
  return handle;
}
export function scoreHandle(handle,rarity='COMMON',instanceNumber=1,maxSupply=1000){
  const h=String(handle).toLowerCase();
  const [min,max]=RARITY_BASE[rarity]||RARITY_BASE.COMMON;
  let score=(min+max)/2;
  const len=h.length;
  if(len<=4)score*=2.3;else if(len<=5)score*=1.65;else if(len<=7)score*=1.25;else if(len>=12)score*=.72;
  if(!/\d/.test(h))score*=1.45;
  if(/777$/.test(h))score*=1.65;else if(/77$/.test(h))score*=1.28;else if(/007$/.test(h))score*=1.2;
  if(/(\d)\1{1,}/.test(h))score*=1.14;
  if(instanceNumber===1)score*=1.32;else if(instanceNumber<=5)score*=1.14;
  if(maxSupply<=50)score*=1.18;else if(maxSupply<=150)score*=1.08;
  const jitter=.9+Math.random()*.2;
  return Math.max(100,Math.round(score*jitter/50)*50);
}
export function generatedSupply(rarity){
  return {COMMON:5000,RARE:2500,EPIC:1200,LEGEND:350,ULTRA:80}[rarity]||5000;
}
export function candidateUniverseSize(){return ROOTS.length*SUFFIXES.length+ROOTS.length*(PREFIXES.length-1)}
