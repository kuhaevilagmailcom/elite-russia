import crypto from 'node:crypto';
import {RARITY_WEIGHTS,USERNAME_RULES} from './config.mjs';
import {randomUnit} from './economy.mjs';
import {analyzeUsername} from './valuation.mjs';
import {REAL_ENGLISH_ROOTS} from './lexicon-real-en.mjs';

const EXTRA_RU_ROOTS=[
  'bratan','bratok','patsan','chelik','maloy','krasava','krutoy','chetko','topchik','privet',
  'poka','spasibo','druzhba','druzya','rodnoy','rodnaya','semya','batya','batka','mamulya',
  'papulya','babushka','dedushka','bratishka','sestrenka','parni','devchonka','paren','devochka','muzhik',
  'rebyata','sosed','sosedka','rayon','gorod','dvor','ulitsa','podik','kvartal','tusovka',
  'dvizh','dvizhuha','vibe','ugar','prikol','memas','shutka','rzhaka','kringe','zhiza',
  'normis','imba','top','skill','profi','krasivo','silno','bistro','legko','zhestko',
  'mashina','tachka','avto','garazh','motor','turbo','drift','gonka','trassa','doroga',
  'moskva','piter','sochi','kazan','ufa','omsk','perm','tula','samara','saratov',
  'ryazan','voronezh','rostov','kursk','tomsk','barnaul','irkutsk','vologda','tambov','tver',
  'ivan','vanya','vanechka','dima','dimon','vova','vovan','maks','maxim','roma',
  'romka','artem','artemka','sasha','sanya','pasha','pashka','kolya','nikita','denis',
  'danil','danya','egor','ilya','gleb','timur','ruslan','bogdan','misha','mishka',
  'vasya','petya','semen','yura','igor','oleg','anton','andrey','sergey','slava',
  'lesha','alexey','kostya','kirill','vitalik','zhenya','tolik','gena','grisha','fedor',
  'sonya','anya','masha','dasha','katya','lena','vika','nastya','alina','arina',
  'polina','sveta','olya','yulya','liza','vera','ira','marina','milana','sofia',
  'kotik','kotenok','koshka','pesik','sobaka','volk','medved','zayka','zaya','lisa',
  'tigr','lev','orel','akula','panda','enot','barsik','murzik','sharik','bobik',
  'babki','dengi','rubli','cashik','profit','bogatyi','bogach','kapital','biznes','market',
  'prodazha','pokupka','obmen','torg','skidka','cena','dorogo','deshevo','million','lamba',
  'mers','gelik','bumer','priora','vesta','granta','niva','camry','supra','skyline',
  'iphone','android','telegram','tgchat','kanal','chatik','botik','admin','moder','owner',
  'krasnyi','chernyi','belii','sinii','zelenyi','zoloto','serebro','almaz','brilliant','korol',
  'car','domik','dacha','banya','lesok','more','reka','gory','solnce','luna'
];


const LEXICON_CATEGORY_ROOTS=Object.freeze({
  names:[
    'matvey','matvei','maksim','alexandr','aleksandr','alexander','mikhail','mihail','michael','dmitry','dmitriy','vladimir',
    'vyacheslav','stanislav','yaroslav','vsevolod','leonid','valera','valeriy','viktor','victor','roman','danila','daniil',
    'mark','markus','lev','leon','stepan','platon','miron','rodion','arseniy','arsen','georgiy','german','robert','eduard',
    'elena','ekaterina','katerina','victoria','viktoria','elizaveta','elizabet','anastasia','anastasiya','alexandra','aleksandra',
    'valeria','valeriya','veronika','kristina','karina','diana','eva','evgenia','evgeniya','natalia','natalya','tatiana','tatyana',
    'oksana','lyubov','nadezhda','galina','larisa','irina','olga','yulia','yuliya','anna','maria','mariya','ksenia','kseniya',
    'alice','alise','emily','emma','oliver','liam','noah','james','lucas','henry','jack','leo','daniel','david','adam','sam','john'
  ],
  cities:[
    'novosibirsk','ekaterinburg','chelyabinsk','krasnodar','krasnoyarsk','vladivostok','habarovsk','khabarovsk','tyumen',
    'kaliningrad','volgograd','orenburg','izhevsk','kirov','astrahan','astrakhan','penza','lipetsk','belgorod','murmansk',
    'yakutsk','grozny','mahachkala','makhachkala','stavropol','sevastopol','simferopol','pskov','kostroma','ivanovo','bryansk',
    'smolensk','orelcity','nalchik','vladimircity','yoshkarola','saransk','cheboksary','ulyanovsk','novgorod','petrozavodsk',
    'london','paris','berlin','madrid','rome','roma','tokyo','seoul','dubai','miami','boston','chicago','toronto','oslo',
    'vienna','prague','warsaw','helsinki','riga','tallinn','vilnius','minsk','tbilisi','yerevan','baku','astana','almaty',
    'bishkek','tashkent','beijing','shanghai','singapore','sydney','melbourne','delhi','mumbai','cairo','istanbul','athens',
    'lisbon','zurich','geneva','brussels','amsterdam','rotterdam','stockholm','copenhagen','budapest','bucharest','sofia'
  ],
  funny:[
    'babushka','dedushka','babka','dedka','batya','mamulya','papulya','tetyushka','dyadya','osloeb','govno','zalupa','penis',
    'sanina','zhopa','pisyun','chlen','sosun','sosal','sosi','govnyuk','govnar','mudak','dolboeb','eblan','eban','blyad',
    'blyat','suka','nahuy','pizda','huy','hui','ebat','zaebal','zaebis','pizdec','pizdets','durak','debil','idiot','loshara',
    'loh','loch','bomzh','kringe','krinzh','rzhaka','ugarchik','memas','prikol','prikolist','shiza','zhiza','chelik','chuvak',
    'bro','bruh','bratan','bratok','patsan','vasya','petrovich','ivanich','dedinside','sigma','skuf','altushka','normis',
    'shkolnik','student','uchilka','direktor','sosed','sosedka','podik','podezd','tualet','unitaz','nosok','tapok','ogurec'
  ],
  ruWords:[
    'dobro','zlo','schastye','radost','grust','pechal','lyubov','nenavist','druzhba','semya','dom','kvartira','shkola','univer',
    'rabota','otdyh','otpusk','more','reka','ozero','les','pole','gora','nebo','zemlya','ogon','voda','vozduh','veter','dozhd',
    'sneg','solnce','luna','zvezda','utro','den','vecher','noch','vesna','leto','osen','zima','hleb','moloko','chay','kofe',
    'sup','borsh','pelmeni','kotleta','kartoshka','arbuz','yabloko','banan','limon','apelsin','ogurec','pomidor','sir','myaso',
    'riba','kurica','kot','koshka','sobaka','pes','volk','lisa','zayac','medved','olen','orel','voron','golub','utka','gus',
    'korova','loshad','svinya','koza','ovca','mysh','krisa','ryba','akula','kit','delfin','rak','krab','zmeya','zhuk','muha'
  ],
  english:[
    'devil','deer','angel','demon','heaven','hell','happy','sad','funny','crazy','stupid','smart','brave','kind','evil','good',
    'bad','trash','garbage','toilet','sock','shoe','grandma','grandpa','mother','father','brother','sister','friend','family',
    'house','home','school','student','teacher','city','village','country','forest','river','lake','mountain','ocean','island',
    'fire','water','earth','wind','rain','snow','sun','moon','star','night','morning','evening','summer','winter','spring',
    'autumn','coffee','tea','bread','milk','apple','banana','lemon','orange','cheese','meat','fish','chicken','cat','dog',
    'mouse','rat','horse','cow','pig','goat','sheep','snake','bird','duck','goose','whale','dolphin','crab','spider','beetle'
  ]
});

const MASS_LEXICON_TARGET=120000;
function cleanLexiconRoot(value){
  return String(value||'').toLowerCase().replace(/[^a-z]/g,'').slice(0,USERNAME_RULES.maxLength);
}
function buildMassLexicon(base,target=MASS_LEXICON_TARGET){
  const out=new Set();
  const add=value=>{
    const root=cleanLexiconRoot(value);
    if(root.length>=3&&root.length<=15)out.add(root);
  };
  for(const value of base)add(value);
  for(const group of Object.values(LEXICON_CATEGORY_ROOTS))for(const value of group)add(value);

  const priority=[
    'dark','black','white','red','blue','green','gold','silver','big','small','super','mega','ultra','real','true','only','top',
    'pro','king','boss','lord','baby','crazy','wild','cool','hot','cold','night','day','city','street','rus','ru','mgn','tg',
    'brat','batya','ded','babka','kot','pes','govno','zalupa','devil','angel','deer','sigma','skuf','mem','lol'
  ].map(cleanLexiconRoot).filter(Boolean);

  const seeds=[...out].filter(x=>x.length>=3&&x.length<=14);
  for(const left of priority){
    for(const right of seeds){
      add(left+right);
      if(out.size>=target)return [...out];
      add(right+left);
      if(out.size>=target)return [...out];
    }
  }

  for(let i=0;i<seeds.length&&out.size<target;i++){
    const a=seeds[i];
    for(let j=0;j<seeds.length&&out.size<target;j++){
      const b=seeds[j];
      if(a===b)continue;
      if(a.length+b.length<=15)add(a+b);
      if(out.size>=target)break;
      if((i+j)%3===0&&a.length+b.length<=15)add(b+a);
    }
  }
  if(out.size<target)throw new Error('username_lexicon_too_small:'+out.size);
  return [...out];
}

const BASE_ROOTS=[
...REAL_ENGLISH_ROOTS,
...EXTRA_RU_ROOTS,
'card','loly','mama','papa','sosi','sosal','dedyska','brat','sestra','drug','svoy','kot','pes','babka','ded','vova','dima','tema','maks','vlad','roma','sasha','sanya','artem','vasya','petya','kirill','ruslan','bogdan','sigma','love','dream','angel','baby','cool','club','news','music','bank','shop','monk','ghost','void','vision','legend','dealer','storm','night','phantom','million','master','mister','king','prime','rocket','shadow','venom','savage','black','white','wolf','tiger','moon','solar','street','drive','speed','turbo','money','rich','diamond','silver','rare','zero','pixel','cloud','wave','nova','silent','unknown','anonymous','alpha','omega','orbit','pulse','frame','motion','vector','signal','matrix','vertex','binary','cipher','static','future','chrome','carbon','graphite','velvet','royal','elite','major','minor','urban','metro','avenue','district','tower','garage','motor','rider','pilot','racer','drift','boost','nitro','gtr','amg','bmw','mclaren','porsche','supra','skyline','viper','cobra','falcon','hawk','raven','lion','panther','shark','orca','fox','bear','eagle','hunter','chief','boss','owner','founder','leader','winner','champion','hero','icon','famous','classic','vintage','simple','basic','clean','mono','blank','pure','clear','sharp','swift','quick','rapid','sonic','flash','light','bright','dark','midnight','sunset','dawn','winter','summer','north','south','west','east','ocean','river','stone','steel','iron','gold','platinum','onyx','jade','ruby','sapphire','emerald','luxury','premium','status','credit','cash','market','trade','stock','vault','mint','coin','profit','wealth','capital','business','studio','media','audio','beat','bass','vibe','mood','style','fashion','model','design','art','photo','film','camera','scene','screen','game','player','level','score','rank','top','arena','clutch','skill','aim','quest','party','lobby','server','online','digital','cyber','logic','code','byte','data','node','core','link','network','system','device','mobile','phone','apple','telegram','social','viral','trend','daily','global','world','planet','space','cosmos','astro','mars','lunar','star','comet','galaxy','mystic','secret','hidden','private','public','real','true','only','first','last','young','old','modern','retro','smart','wild','calm','cold','hot','high','low','big','small','great','super','hyper','ultra','max','pro','one','seven','noble','monarch','duke','baron','saint','ace','zen','echo','flux','frost','blaze','ember','mist','rain','snow','thunder','volt','crisp','solid','fluid','stark','roman','atlas','apollo','mercury','saturn','jupiter','venus','pluto','delta','lambda','kappa','daylight','nightfall','blackout','overdrive','redline','pitlane','roadster','coupe','sedan','touring','motors','driver','fastlane','highway','cityline','skyway','airline','railway','terminal','station','central','uptown','downtown','midtown','brook','park','garden','forest','valley','mountain','island','harbor','port','bay','coast','beach','desert','canyon','cliff','peak','summit','ridge','field','meadow','green','blue','red','orange','purple','gray','grey','ivory','obsidian','crystal','marble','granite','wood','paper','glass','metal','titanium','cobalt','nickel','copper','bronze','brass'
];

export const ROOTS=buildMassLexicon(BASE_ROOTS);
if(ROOTS.length<100000)throw new Error('username_lexicon_too_small:'+ROOTS.length);

export const SUFFIXES=['','7','77','777','1','01','07','007','x','xx','pro','one','max','hq','live','lab','io','tv','club','zone','hub','net','go'];
export const PREFIXES=['','the','real','mr','its','iam'];

export const SPECIALS=[
  // Telegram-native three-letter handles: the scarcest usernames in the game.
  ['nft','ULTRA',75000000,1,'telegram_legacy'],
  ['ufc','ULTRA',70000000,1,'telegram_legacy'],
  ['gif','ULTRA',68000000,1,'telegram_legacy'],
  ['vid','ULTRA',64000000,1,'telegram_legacy'],
  ['pic','ULTRA',62000000,1,'telegram_legacy'],

  // Memorable Russian/translit words are intentionally valuable too.
  ['card','ULTRA',15000000,1,'short_word'],
  ['mama','ULTRA',12000000,1,'ru_word'],
  ['papa','ULTRA',11000000,1,'ru_word'],
  ['sosi','ULTRA',9800000,1,'ru_word'],
  ['sosal','ULTRA',8200000,1,'ru_word'],
  ['brat','ULTRA',7600000,1,'ru_word'],
  ['dedyska','LEGEND',5600000,1,'ru_word'],
  ['sestra','LEGEND',4800000,1,'ru_word'],
  ['drug','ULTRA',6200000,1,'ru_word'],
  ['svoy','LEGEND',4400000,1,'ru_word'],
  ['kot','ULTRA',9000000,1,'ru_word'],
  ['pes','ULTRA',8500000,1,'ru_word'],
  ['ded','ULTRA',8000000,1,'ru_word'],
  ['babka','LEGEND',3600000,1,'ru_word'],
  ['vova','ULTRA',5200000,1,'ru_name'],
  ['dima','ULTRA',5200000,1,'ru_name'],
  ['tema','ULTRA',4900000,1,'ru_name'],
  ['maks','ULTRA',5100000,1,'ru_name'],
  ['vlad','ULTRA',4700000,1,'ru_name'],
  ['roma','ULTRA',4600000,1,'ru_name'],
  ['sasha','LEGEND',3900000,1,'ru_name'],
  ['sanya','LEGEND',3500000,1,'ru_name'],
  ['artem','LEGEND',3900000,1,'ru_name'],
  ['vasya','LEGEND',3300000,1,'ru_name'],
  ['petya','LEGEND',3100000,1,'ru_name'],
  ['kirill','LEGEND',2500000,1,'ru_name'],
  ['ruslan','LEGEND',2400000,1,'ru_name'],
  ['bogdan','LEGEND',2300000,1,'ru_name'],
  ['batya','ULTRA',7200000,1,'ru_word'],
  ['paren','ULTRA',5600000,1,'ru_word'],
  ['muzhik','ULTRA',4400000,1,'ru_word'],
  ['rayon','ULTRA',4300000,1,'ru_word'],
  ['gorod','ULTRA',4200000,1,'ru_word'],
  ['dvor','ULTRA',6100000,1,'ru_word'],
  ['dvizh','ULTRA',4900000,1,'ru_word'],
  ['zhiza','ULTRA',4700000,1,'ru_word'],
  ['imba','ULTRA',5300000,1,'ru_word'],
  ['privet','ULTRA',3600000,1,'ru_word'],
  ['poka','ULTRA',5800000,1,'ru_word'],
  ['babki','ULTRA',3900000,1,'ru_word'],
  ['rubli','ULTRA',3500000,1,'ru_word'],
  ['dengi','ULTRA',4200000,1,'ru_word'],
  ['torg','ULTRA',5100000,1,'ru_word'],
  ['cena','ULTRA',5600000,1,'ru_word'],
  ['obmen','ULTRA',3300000,1,'ru_word'],
  ['tachka','ULTRA',3200000,1,'ru_word'],
  ['gelik','ULTRA',3700000,1,'ru_word'],
  ['bumer','ULTRA',3400000,1,'ru_word'],
  ['priora','ULTRA',2900000,1,'ru_word'],
  ['niva','ULTRA',5200000,1,'ru_word'],
  ['vanya','ULTRA',4200000,1,'ru_name'],
  ['pasha','ULTRA',4100000,1,'ru_name'],
  ['kolya','ULTRA',3900000,1,'ru_name'],
  ['nikita','ULTRA',3000000,1,'ru_name'],
  ['denis','ULTRA',3000000,1,'ru_name'],
  ['danya','ULTRA',3200000,1,'ru_name'],
  ['egor','ULTRA',4700000,1,'ru_name'],
  ['ilya','ULTRA',4700000,1,'ru_name'],
  ['gleb','ULTRA',4600000,1,'ru_name'],
  ['misha','ULTRA',4000000,1,'ru_name'],
  ['anton','ULTRA',3200000,1,'ru_name'],
  ['andrey','ULTRA',2800000,1,'ru_name'],
  ['sergey','ULTRA',2700000,1,'ru_name'],
  ['anya','ULTRA',4900000,1,'ru_name'],
  ['masha','ULTRA',4000000,1,'ru_name'],
  ['dasha','ULTRA',3900000,1,'ru_name'],
  ['katya','ULTRA',3800000,1,'ru_name'],
  ['lena','ULTRA',4300000,1,'ru_name'],
  ['vika','ULTRA',4500000,1,'ru_name'],
  ['nastya','ULTRA',3300000,1,'ru_name'],
  ['alina','ULTRA',3400000,1,'ru_name'],
  ['sonya','ULTRA',3600000,1,'ru_name'],
  ['kotik','ULTRA',3600000,1,'ru_word'],
  ['koshka','ULTRA',3100000,1,'ru_word'],
  ['pesik','ULTRA',3200000,1,'ru_word'],
  ['volk','ULTRA',5200000,1,'ru_word'],
  ['medved','ULTRA',3000000,1,'ru_word'],
  ['panda','ULTRA',3500000,1,'ru_word'],
  ['enot','ULTRA',4400000,1,'ru_word'],
  ['monk','ULTRA',10000000,1,'short_word'],
  ['void','ULTRA',9000000,1,'short_word'],
  ['loly','ULTRA',6000000,1,'short_word'],
  ['sigma','ULTRA',2200000,1,'word'],
  ['ghost','ULTRA',2100000,1,'word'],
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
  ['blackout','EPIC',140000,1,'word'],
  ['venom77','RARE',70000,1,'pattern'],
  ['gtr77','RARE',55000,1,'pattern'],
  ['amg77','RARE',55000,1,'pattern'],
  ['m5pro','RARE',35000,1,'pattern']
];

export const TELEGRAM_THREE_LETTER=new Set(['nft','gif','pic','vid','ufc']);
export function hasLetter(handle){return /[a-z]/i.test(String(handle||''))}
export function isValidHandle(handle){
  const h=String(handle||'').toLowerCase();
  if(TELEGRAM_THREE_LETTER.has(h))return true;
  return new RegExp(USERNAME_RULES.pattern,'i').test(h)&&hasLetter(h);
}
const clampUnit=x=>Math.max(0,Math.min(.999999999,Number(x)||0));
export function randInt(min,max,rng=randomUnit){return min+Math.floor(clampUnit(rng())*(max-min+1))}
export function choice(arr,rng=randomUnit){return arr[Math.floor(clampUnit(rng())*arr.length)]}

export function weightedRarity(rng=randomUnit){
  const x=rng()*100;let sum=0;
  for(const r of ['COMMON','RARE','EPIC','LEGEND','ULTRA']){sum+=RARITY_WEIGHTS[r];if(x<sum)return r}
  return 'COMMON';
}
function prettyDigits(rng){return choice(['7','77','777','01','07','007','1','11','21','47','69','88','99'],rng)}
function randomLetters(min=6,max=10,rng=randomUnit){
  const alphabet='abcdefghijklmnopqrstuvwxyz',len=randInt(min,max,rng);let s='';
  for(let i=0;i<len;i++)s+=choice([...alphabet],rng);
  return s;
}
function randomPronounceable(min=4,max=8,rng=randomUnit){
  const consonants='bcdfghjklmnpqrstvwxyz',vowels='aeiou',len=randInt(min,max,rng);let s='';
  const startsWithConsonant=rng()<.72;
  for(let i=0;i<len;i++){
    const consonant=(i%2===0)===startsWithConsonant;
    s+=choice([...(consonant?consonants:vowels)],rng);
  }
  return s;
}
function normalizeGenerated(handle){
  let h=String(handle||'').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,15);
  if(h.length<USERNAME_RULES.minLength)h=(h+'name').slice(0,USERNAME_RULES.minLength);
  if(!hasLetter(h))h='u'+h.slice(0,USERNAME_RULES.maxLength-1);
  return h;
}
const ROOTS_BY_LENGTH=Array.from({length:33},()=>[]);
for(const root of ROOTS)if(/^[a-z]+$/.test(root)&&root.length<ROOTS_BY_LENGTH.length)ROOTS_BY_LENGTH[root.length].push(root);
function rootForProfile(profile,rng){
  const range={COMMON:[7,15],RARE:[6,14],EPIC:[5,10],LEGEND:[4,8],ULTRA:[4,6]}[profile]||[7,15];
  const lengths=[];for(let len=range[0];len<=range[1];len++)if(ROOTS_BY_LENGTH[len]?.length)lengths.push(len);
  if(!lengths.length)return choice(ROOTS,rng).slice(0,15);
  return choice(ROOTS_BY_LENGTH[choice(lengths,rng)],rng);
}
function telegramStyleVariant(root,profile,rng){
  const r=rng(),pretty=prettyDigits(rng);
  if(profile==='COMMON'){
    if(r<.16)return root;
    if(r<.42)return root+randInt(1,999,rng);
    if(r<.56)return root+'_'+randInt(1,99,rng);
    if(r<.69)return root+'_'+pretty;
    if(r<.82)return choice(['real_','the_','its_'],rng)+root;
    return root+choice(['7','77','x','01'],rng);
  }
  if(profile==='RARE'){
    if(r<.46)return root;
    if(r<.62)return root+pretty;
    if(r<.72)return root+'_'+choice(['7','77','01'],rng);
    if(r<.84)return root+'x';
    return choice(['real_','the_'],rng)+root;
  }
  if(profile==='EPIC'){
    if(r<.68)return root;
    if(r<.82)return root+choice(['7','77','x'],rng);
    if(r<.9)return root+'_'+choice(['7','x'],rng);
    return randomPronounceable(5,6,rng);
  }
  if(profile==='LEGEND')return r<.83?root:(r<.93?root+'7':randomPronounceable(5,5,rng));
  return r<.76?root:randomPronounceable(4,5,rng);
}
export function buildGeneratedHandle(profile='COMMON',rng=randomUnit){
  const root=rootForProfile(profile,rng),roll=rng();let handle;
  if(profile==='COMMON'&&roll<.12)handle=randomLetters(7,10,rng);
  else if(profile==='RARE'&&roll<.10)handle=randomPronounceable(6,8,rng);
  else handle=telegramStyleVariant(root,profile,rng);
  return normalizeGenerated(handle);
}
const WORD_SET=new Set(ROOTS.map(x=>String(x).toLowerCase()).filter(x=>/^[a-z]{3,15}$/.test(x)));
export function wordQuality(handle){
  const h=String(handle||'').toLowerCase(),letters=h.replace(/[^a-z]/g,'');
  if(WORD_SET.has(h))return 1;
  if(WORD_SET.has(letters)&&/^[a-z]+\d{1,3}$/.test(h))return .72;
  if(WORD_SET.has(letters))return .62;
  const vowelRatio=(letters.match(/[aeiou]/g)||[]).length/Math.max(1,letters.length),ugly=/[bcdfghjklmnpqrstvwxyz]{4,}|[aeiou]{4,}/.test(letters);
  if(!ugly&&vowelRatio>=.25&&vowelRatio<=.6&&letters.length<=6)return .56;
  if(!ugly&&vowelRatio>=.25&&vowelRatio<=.6)return .42;
  return .22;
}
// Canonical pricing now comes from the semantic valuation engine.
export function rarityFromValue(value){
  const v=Math.max(0,Number(value)||0);
  if(v>=2000000)return 'ULTRA';
  if(v>=500000)return 'LEGEND';
  if(v>=100000)return 'EPIC';
  if(v>=15000)return 'RARE';
  return 'COMMON';
}
export function scoreHandle(handle,_rarity='COMMON',_instanceNumber=1,_maxSupply=1,_rng=randomUnit){
  return analyzeUsername(handle).value;
}
export function stableScoreHandle(handle){
  return analyzeUsername(handle).value;
}
export function assessHandle(handle,{stable=false,theme=''}={}){
  const a=analyzeUsername(handle,{theme});
  return {handle:a.handle,value:a.value,rarity:rarityFromValue(a.value),quality:a.breakdown?.word||0,length:a.handle.length,score:a.score,visual:a.visual,breakdown:a.breakdown};
}
export function generatedSupply(){return 1}
export function candidateUniverseSize(){return ROOTS.length*SUFFIXES.length+ROOTS.length*(PREFIXES.length-1)}
const CURATED_REAL_ROOTS=new Set([
  ...REAL_ENGLISH_ROOTS,
  ...EXTRA_RU_ROOTS,
  ...Object.values(LEXICON_CATEGORY_ROOTS).flat()
].map(cleanLexiconRoot).filter(x=>x.length>=3&&x.length<=USERNAME_RULES.maxLength));
export const LEXICON_STATS=Object.freeze({
  roots:ROOTS.length,
  realRoots:CURATED_REAL_ROOTS.size,
  generatedFallbackRoots:Math.max(0,ROOTS.length-CURATED_REAL_ROOTS.size),
  minimumRoots:MASS_LEXICON_TARGET,
  candidateUniverseUpperBound:candidateUniverseSize(),
  categories:Object.fromEntries(Object.entries(LEXICON_CATEGORY_ROOTS).map(([key,items])=>[key,items.length]))
});
