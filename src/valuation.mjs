const COMMON_WORDS=new Set([
  'money','game','video','photo','music','car','cars','love','news','shop','bank','market','trade','stock','vault',
  'crypto','coin','profit','capital','business','studio','media','audio','design','art','film','camera','player','level',
  'score','rank','arena','skill','online','digital','code','data','network','mobile','phone','telegram','social','global',
  'world','space','pixel','nova','orbit','vision','ghost','shadow','venom','panda','wolf','tiger','lion','eagle','bear',
  'nova','boost','prime','elite','royal','gold','silver','diamond','club','city','metro','street','drive','speed','turbo',
  'devil','deer','angel','demon','heaven','hell','happy','sad','funny','crazy','grandma','grandpa','family','house','school',
  'forest','river','lake','mountain','ocean','fire','water','earth','wind','rain','snow','coffee','bread','apple','banana'
]);
const RU_TRANSLIT=new Set([
  'mama','papa','batya','brat','drug','ded','dedushka','dedyska','babka','sestra','dvor','rayon','gorod','ulitsa',
  'babki','dengi','rubli','cena','obmen','torg','skidka','tachka','mashina','privet','poka','zhiza','dvizh','imba',
  'kot','kotik','pes','pesik','volk','medved','enot','panda','moskva','piter','sochi','kazan','ufa','omsk','samara',
  'babushka','govno','zalupa','penis','sanina','zhopa','chlen','mudak','dolboeb','blyad','blyat','suka','pizda','nahuy',
  'dobro','zlo','schastye','radost','grust','pechal','lyubov','semya','dom','shkola','univer','rabota','otdyh','borsh','pelmeni'
]);
const NAMES=new Set([
  'vlad','dima','dimon','vova','vovan','maks','maxim','roma','artem','sasha','sanya','pasha','kolya','nikita','denis',
  'danya','egor','ilya','gleb','timur','ruslan','bogdan','misha','anton','andrey','sergey','anya','masha','dasha',
  'katya','lena','vika','nastya','alina','sonya','ivan','yura','igor','oleg','kirill','matvey','matvei','maksim','alexandr',
  'aleksandr','mikhail','mihail','dmitry','vladimir','roman','danila','daniil','mark','stepan','miron','arseniy','georgiy',
  'elena','ekaterina','viktoria','victoria','elizaveta','anastasia','alexandra','valeria','veronika','kristina','diana','eva'
]);
const CITIES=new Set(['moskva','moscow','piter','sochi','kazan','ufa','omsk','perm','samara','saratov','rostov','tomsk','novosibirsk','ekaterinburg','chelyabinsk','krasnodar','krasnoyarsk','vladivostok','habarovsk','tyumen','kaliningrad','volgograd','orenburg','izhevsk','murmansk','yakutsk','grozny','stavropol','london','paris','berlin','madrid','rome','tokyo','seoul','dubai','miami','chicago','toronto','oslo','vienna','prague','warsaw','helsinki','riga','tallinn','vilnius','minsk','tbilisi','baku','astana','almaty']);
const SEMANTIC={
  finance:new Set(['money','cash','bank','coin','crypto','profit','capital','market','trade','stock','vault','dengi','babki','rubli','cena']),
  gaming:new Set(['game','player','level','score','rank','arena','clutch','skill','aim','quest','server','online']),
  cars:new Set(['car','cars','auto','avto','tachka','bmw','amg','gtr','supra','skyline','porsche','turbo','drift','motor','speed']),
  media:new Set(['music','video','photo','media','audio','film','camera','gif','pic','vid']),
  tech:new Set(['ai','code','data','node','network','system','digital','cyber','telegram','pixel']),
  sports:new Set(['ufc','sport','sports','fight','boxing','football','soccer','mma']),
  names:NAMES,cities:CITIES,animals:new Set(['cat','dog','wolf','tiger','lion','bear','eagle','panda','enot','kot','pes','volk'])
};
const PRETTY_DIGITS=/^(7|77|777|007|666|888|333|111|123)$/;
const VOWELS=/[aeiouy]/g;

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function normalizeUsername(input){
  return String(input||'').trim().replace(/^@+/,'').toLowerCase();
}
export function isGameUsername(input,{allowCuratedShort=false}={}){
  const h=normalizeUsername(input);
  if(allowCuratedShort&&/^[a-z0-9_]{3}$/.test(h))return true;
  return /^[a-z0-9_]{4,15}$/.test(h)&&/[a-z]/.test(h);
}
function pronounceability(h){
  const letters=h.replace(/[^a-z]/g,'');if(!letters)return 0;
  const vowels=(letters.match(VOWELS)||[]).length,ratio=vowels/letters.length;
  let s=ratio>=.22&&ratio<=.62?74:ratio>=.12&&ratio<=.72?52:25;
  if(/[bcdfghjklmnpqrstvwxz]{4,}/.test(letters))s-=28;
  if(/[aeiouy]{4,}/.test(letters))s-=20;
  if(/(.)\1\1\1/.test(letters))s-=18;
  if(COMMON_WORDS.has(letters)||RU_TRANSLIT.has(letters)||NAMES.has(letters))s+=22;
  return clamp(s,0,100);
}
function semanticCategory(h){
  const letters=h.replace(/[^a-z]/g,'');
  for(const [key,set] of Object.entries(SEMANTIC))if(set.has(h)||set.has(letters))return key;
  return COMMON_WORDS.has(letters)||RU_TRANSLIT.has(letters)?'word':'other';
}
function patternScore(h){
  const digits=(h.match(/\d+/g)||[]).join('');
  let score=0;
  if(PRETTY_DIGITS.test(digits))score+=42;
  if(/^([a-z])\1{2,}$/.test(h))score+=24;
  if(/^(.{1,3})\1$/.test(h))score+=30;
  if(/^(xoxo|abab|aaaa|xxxx)$/.test(h))score+=42;
  if(/^(vip|top|pro|one|ace|zen)/.test(h))score+=18;
  return clamp(score,0,90);
}
function wordScore(h){
  const letters=h.replace(/[^a-z]/g,'');
  if(COMMON_WORDS.has(h)||RU_TRANSLIT.has(h)||NAMES.has(h)||CITIES.has(h))return 100;
  if(COMMON_WORDS.has(letters)||RU_TRANSLIT.has(letters)||NAMES.has(letters)||CITIES.has(letters))return 72;
  return pronounceability(h)>=70?34:10;
}
function lengthScore(len){
  if(len<=3)return 100;
  if(len===4)return 96;
  if(len===5)return 86;
  if(len===6)return 74;
  if(len===7)return 62;
  if(len===8)return 50;
  if(len===9)return 40;
  if(len===10)return 32;
  if(len<=12)return 22;
  return 10;
}
function smoothPrice(score){
  const points=[[0,300],[200,2500],[350,10000],[500,50000],[650,250000],[800,1500000],[900,10000000],[1000,80000000]];
  const s=clamp(Math.round(score),0,1000);
  for(let i=1;i<points.length;i++){
    const [s1,p1]=points[i-1],[s2,p2]=points[i];
    if(s<=s2){
      const t=(s-s1)/(s2-s1),e=t*t*(3-2*t);
      return Math.round((p1+(p2-p1)*e)/50)*50;
    }
  }
  return points.at(-1)[1];
}
export function visualTier(value,score=0){
  const v=Number(value)||0,s=Number(score)||0;
  if(v>=1000000||s>=800)return 'gold';
  if(v>=100000||s>=650)return 'purple';
  if(v>=10000||s>=450)return 'blue';
  return 'normal';
}
export function analyzeUsername(input,{theme=''}={}){
  const handle=normalizeUsername(input),valid=isGameUsername(handle,{allowCuratedShort:true}),len=handle.length;
  if(!valid)return {handle,valid:false,score:0,value:0,visual:'normal',category:'invalid',breakdown:{}};
  const letters=handle.replace(/[^a-z]/g,''),digits=(handle.match(/\d/g)||[]).length,underscores=(handle.match(/_/g)||[]).length;
  const length=lengthScore(len),word=wordScore(handle),pronounce=pronounceability(handle),pattern=patternScore(handle),category=semanticCategory(handle);
  const semantic=category==='other'?12:category==='word'?58:82;
  const cultural=RU_TRANSLIT.has(handle)||NAMES.has(handle)||CITIES.has(handle)?92:COMMON_WORDS.has(handle)?66:20;
  const clean=clamp(100-digits*12-underscores*20,0,100);
  const brand=clamp(Math.round(pronounce*.52+word*.38+(len<=8?12:0)),0,100);
  const digitPenalty=digits*(PRETTY_DIGITS.test((handle.match(/\d+/g)||[]).join(''))?10:24);
  const underscorePenalty=underscores*38;
  const garbagePenalty=pronounce<35?70:pronounce<50?30:0;
  const themeKey=String(theme||'').toLowerCase(),themeSet=SEMANTIC[themeKey],themeMatch=themeSet?(themeSet.has(handle)||themeSet.has(letters)?100:category===themeKey?85:25):60;
  let score=Math.round(
    length*2.05+word*2.15+semantic*1.25+brand*.95+pattern*.85+pronounce*1.15+clean*.55+cultural*.55+
    themeMatch*.25-digitPenalty-underscorePenalty-garbagePenalty
  );
  if(len===4)score+=55;
  if(len===3)score+=120;
  score=clamp(score,0,1000);
  const value=smoothPrice(score);
  return {
    handle,valid:true,score,value,visual:visualTier(value,score),category,themeMatch,
    breakdown:{
      length:Math.round(length),word:Math.round(word),semantic:Math.round(semantic),brand:Math.round(brand),
      pattern:Math.round(pattern),pronounceability:Math.round(pronounce),cleanliness:Math.round(clean),cultural:Math.round(cultural),
      theme:Math.round(themeMatch),digitPenalty,underscorePenalty,garbagePenalty
    }
  };
}
export function canonicalUsernameValue(input){return analyzeUsername(input).value}
export function usernameScore(input){return analyzeUsername(input).score}
