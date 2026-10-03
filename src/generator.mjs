import crypto from 'node:crypto';
import {RARITY_WEIGHTS,RARITY_BASE} from './config.mjs';

export const ROOTS=[
'card','loly','mama','sigma','love','dream','angel','baby','cool','club','news','music','bank','shop','monk','ghost','void','vision','legend','dealer','storm','night','phantom','million','master','mister','king','prime','rocket','shadow','venom','savage','black','white','wolf','tiger','moon','solar','street','drive','speed','turbo','money','rich','diamond','silver','rare','zero','pixel','cloud','wave','nova','silent','unknown','anonymous','alpha','omega','orbit','pulse','frame','motion','vector','signal','matrix','vertex','binary','cipher','static','future','chrome','carbon','graphite','velvet','royal','elite','major','minor','urban','metro','avenue','district','tower','garage','motor','rider','pilot','racer','drift','boost','nitro','gtr','amg','bmw','mclaren','porsche','supra','skyline','viper','cobra','falcon','hawk','raven','lion','panther','shark','orca','fox','bear','eagle','falcon','hunter','chief','boss','owner','founder','leader','winner','champion','hero','icon','famous','classic','vintage','rarely','simple','basic','clean','mono','blank','pure','clear','sharp','swift','quick','rapid','sonic','flash','light','bright','dark','midnight','sunset','dawn','winter','summer','north','south','west','east','ocean','river','stone','steel','iron','gold','platinum','onyx','jade','ruby','sapphire','emerald','luxury','premium','status','credit','cash','market','trade','stock','vault','bank','mint','coin','profit','wealth','capital','business','studio','media','music','audio','beat','bass','vibe','mood','style','fashion','model','design','art','photo','film','camera','scene','screen','game','player','level','score','rank','top','arena','clutch','skill','aim','quest','party','lobby','server','online','digital','cyber','logic','code','byte','data','node','core','link','network','system','device','mobile','phone','apple','telegram','social','viral','trend','daily','global','world','planet','space','cosmos','astro','mars','lunar','star','comet','galaxy','neonless','mystic','secret','hidden','private','public','real','true','only','first','last','young','old','modern','retro','smart','wild','calm','cold','hot','high','low','big','small','great','super','hyper','ultra','max','pro','one','seven','sevenfold','mistery','noble','monarch','duke','baron','saint','ace','zen','echo','flux','frost','blaze','ember','mist','rain','snow','thunder','volt','wavey','crisp','solid','fluid','orbitz','stark','roman','atlas','apollo','mercury','saturn','jupiter','venus','pluto','delta','sigma','lambda','kappa','omegaone','northstar','daylight','nightfall','blackout','whiteout','overdrive','redline','pitlane','roadster','coupe','sedan','touring','classiccar','motors','driver','streetcar','fastlane','highway','cityline','skyway','airline','railway','terminal','station','central','uptown','downtown','midtown','brook','park','garden','forest','valley','mountain','island','harbor','port','bay','coast','beach','desert','canyon','cliff','peak','summit','ridge','field','meadow','green','blue','red','orange','purple','gray','grey','ivory','obsidian','crystal','marble','granite','wood','paper','glass','metal','titanium','cobalt','nickel','copper','bronze','brass'
];
export const SUFFIXES=['','7','77','777','1','01','07','007','x','xx','pro','one','max','hq','live','lab','io','tv','club','zone','hub','net','go'];
export const PREFIXES=['','the','real','mr','its','iam'];

export const SPECIALS=[
  ['monk','ULTRA',750000,25,'short'],
  ['void','ULTRA',620000,35,'short'],
  ['ghost','ULTRA',540000,50,'short'],
  ['card','ULTRA',480000,45,'word'],
  ['mama','ULTRA',420000,55,'word'],
  ['sigma','ULTRA',390000,65,'word'],
  ['loly','LEGEND',110000,150,'word'],
  ['legend','LEGEND',260000,90,'status'],
  ['mister','LEGEND',220000,120,'status'],
  ['vision','LEGEND',190000,140,'word'],
  ['phantom','LEGEND',175000,160,'word'],
  ['million','LEGEND',250000,100,'money'],
  ['dealer','LEGEND',160000,180,'business'],
  ['storm','LEGEND',145000,180,'word'],
  ['prime','LEGEND',180000,150,'status'],
  ['mister777','LEGEND',150000,100,'pattern'],
  ['ghost77','EPIC',60000,500,'pattern'],
  ['master7','EPIC',38000,700,'pattern'],
  ['blackout','EPIC',32000,650,'dark'],
  ['king777','EPIC',45000,450,'pattern'],
  ['venom77','EPIC',31000,650,'pattern'],
  ['gtr77','EPIC',28000,700,'cars'],
  ['amg77','EPIC',28000,700,'cars'],
  ['m5pro','RARE',8000,1200,'cars']
]

export function hasLetter(handle){return /[a-z]/i.test(String(handle||''))}
export function isValidHandle(handle){return /^[a-z][a-z0-9_]{2,9}$/i.test(String(handle||''))&&hasLetter(handle)}
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
function randomLetters(min=4,max=10){
  const consonants='bcdfghjklmnpqrstvwxyz',vowels='aeiou';
  const len=randInt(min,max);let s='';
  for(let i=0;i<len;i++)s+=i%2===0?choice(consonants.split('')):choice(vowels.split(''));
  if(Math.random()<.45){
    const arr=s.split(''),i=randInt(0,arr.length-1);arr[i]=choice(consonants.split(''));s=arr.join('');
  }
  return s;
}
function normalizeGenerated(handle){
  let h=String(handle||'').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,10);
  if(h.length<3)h=(h+'pro').slice(0,3);
  if(!hasLetter(h))h='u'+h.slice(0,9);
  return h;
}
export function buildGeneratedHandle(rarity='COMMON'){
  const root=choice(ROOTS).slice(0,10);
  let handle=root;
  const roll=Math.random();
  if(rarity==='COMMON'){
    if(roll<.22)handle=randomLetters(4,10);
    else if(roll<.48)handle=root;
    else if(roll<.78)handle=root+randInt(1,999);
    else handle=choice(PREFIXES.slice(1))+root;
  }else if(rarity==='RARE'){
    if(roll<.08)handle=randomLetters(4,9);
    else if(roll<.58)handle=root;
    else if(roll<.8)handle=root+prettyDigits();
    else handle=choice(PREFIXES.slice(0,3))+root;
  }else if(rarity==='EPIC'){
    handle=roll<.76?root:(roll<.92?root+choice(['7','77','x']):choice(PREFIXES.slice(0,3))+root);
  }else if(rarity==='LEGEND'){
    handle=roll<.88?root:root+choice(['7','x']);
  }else{
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
export function scoreHandle(handle,rarity='COMMON',instanceNumber=1,maxSupply=1000){
  const h=String(handle).toLowerCase();
  const [min,max]=RARITY_BASE[rarity]||RARITY_BASE.COMMON;
  let score=(min+max)/2;
  const len=h.length;
  const lengthFactor=len<=3?4.1:len===4?3.7:len===5?3.05:len===6?2.2:len===7?1.55:len===8?1.05:len===9?.72:.52;
  score*=lengthFactor;
  const quality=wordQuality(h);
  score*=quality>=1?1.75:quality>=.7?1.18:quality>=.6?1.02:quality>=.4?.72:.38;
  if(!/\d/.test(h))score*=1.28;
  else score*=.86;
  if(/777$/.test(h))score*=1.38;else if(/77$/.test(h))score*=1.18;else if(/007$/.test(h))score*=1.12;
  if(/(\d)\1{1,}/.test(h))score*=1.08;
  if(instanceNumber===1)score*=1.25;else if(instanceNumber<=5)score*=1.1;
  if(maxSupply<=50)score*=1.15;else if(maxSupply<=150)score*=1.06;
  const jitter=.96+Math.random()*.08;
  return Math.max(50,Math.round(score*jitter/50)*50);
}
export function generatedSupply(rarity){
  return {COMMON:5000,RARE:2500,EPIC:1200,LEGEND:350,ULTRA:80}[rarity]||5000;
}
export function candidateUniverseSize(){return ROOTS.length*SUFFIXES.length+ROOTS.length*(PREFIXES.length-1)}
