import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const js=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

const from=js.indexOf('const CRASH_VISIBLE_PLAYERS=10;');
const until=js.indexOf('function crashRoster(bets){',from);
assert.ok(from>=0&&until>from,'crash preview source was not found');
const preview=vm.runInNewContext(js.slice(from,until)+';({crashRewardPreview})');

test('Crash visibly lists at most ten recent bets in one compact row each',()=>{
  const roster=js.slice(js.indexOf('function crashRoster(bets){'),js.indexOf('function crashView(){'));
  assert.match(roster,/slice\(-CRASH_VISIBLE_PLAYERS\)\.reverse\(\)/);
  assert.match(roster,/crash-player-name/);
  assert.match(roster,/crash-stake-summary/);
  assert.match(roster,/esc\(b\.player\)/);
  assert.match(roster,/esc\(b\.handle\)/);
  assert.match(roster,/fmt\(b\.value\)/);
  assert.doesNotMatch(roster,/cashoutX|win_amount|b\.win/);
  assert.match(css,/\.crash-bet-row\{\s*flex:1 1 0/);
  assert.match(css,/\.crash-stake-summary b\{min-width:0;overflow:hidden/);
});

test('Crash header does not show shared crash or public round number',()=>{
  const screen=js.slice(js.indexOf('function crashView(){'),js.indexOf('let crashTickerBusy=',js.indexOf('function crashView(){')));
  assert.match(screen,/>КРАШ<\/b>/);
  assert.doesNotMatch(screen,/ОБЩИЙ КРАШ|Раунд #|Прошлый раунд|Первый раунд/);
  assert.ok(screen.includes("'Последние '+CRASH_VISIBLE_PLAYERS"));
});

test('Crash flight displays server-reserved real usernames whose values increase',()=>{
  const xs=[1,1.1,1.5,2,3,5,10,20,50,100,200,500,1000];
  const plan=Array.from({length:35},(_,i)=>({
    multiplier:Number(Math.exp(Math.log(1000)*i/34).toFixed(6)),
    handle:'@reward_'+i
  }));
  let prior=0;
  const names=new Set();
  for(const x of xs){
    const result=preview.crashRewardPreview(plan,x,100000);
    assert.ok(result.handle.startsWith('@'));
    assert.ok(result.value>=prior,'value decreased at x'+x);
    names.add(result.handle);
    prior=result.value;
  }
  assert.ok(names.size>=10,'winning username does not change often enough');
  assert.equal(preview.crashRewardPreview(plan,2.5,100000).value,250000);
  assert.equal(preview.crashRewardPreview(plan,1000,100000).value,100000000);
  assert.equal(preview.crashRewardPreview(plan,1000,100000000).value,1000000000);
  assert.equal(preview.crashRewardPreview([],2.5,100000),null);
  assert.doesNotMatch(js,/CRASH_FLIGHT_PREVIEW|Цены в полёте — пример/);
});

test('Crash flight uses animated SVG curved path and remains single-screen',()=>{
  assert.match(js,/function crashBezierPoint\(p,w,h\)/);
  assert.match(js,/setAttribute\('d',pathFor\(p\)\)/);
  assert.match(js,/flying\.style|flight\.style\.setProperty\('--crash-x'/);
  assert.match(js,/\.style\.setProperty\('--crash-y'/);
  assert.match(js,/requestAnimationFrame\(frame\)/);
  assert.match(js,/id="crashGraphSvg"/);
  assert.match(js,/data-crash-autostop="off"/);
  assert.match(js,/data-crash-autostop-custom/);
  assert.match(js,/data-crash-autostop-save/);
  assert.match(js,/\/api\/crash\/autostop/);
  assert.match(css,/\.crash-page,\.is-desktop \.crash-page\{/);
  assert.match(css,/\.crash-stage,.is-desktop \.crash-stage\{/);
  assert.match(css,/\.crash-auto-presets\{/);
  assert.match(css,/\.crash-auto-chip\.active\{/);
  assert.match(html,/\/styles\.css\?v=7\.5\.0-crash2/);
  assert.match(html,/\/app\.js\?v=7\.5\.0-crash2/);
});
