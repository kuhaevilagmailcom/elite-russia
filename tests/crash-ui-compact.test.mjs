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
const preview=vm.runInNewContext(js.slice(from,until)+';({crashPreviewForMultiplier,CRASH_FLIGHT_PREVIEW})');

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

test('Crash flying preview price increases monotonically with the shared multiplier',()=>{
  const xs=[1,1.1,1.5,2,3,5,10,20,50,100,200,500,1000];
  let prior=0;
  const names=new Set();
  for(const x of xs){
    const [handle,value]=preview.crashPreviewForMultiplier(x);
    assert.ok(handle.startsWith('@'));
    assert.ok(value>=prior,'value decreased at x'+x);
    names.add(handle);
    prior=value;
  }
  assert.ok(names.size>=10,'username preview does not change often enough');
  assert.equal(preview.crashPreviewForMultiplier(1000)[1],200000000);
});

test('Crash has diagonal x/y movement and stays on one screen',()=>{
  assert.match(js,/flying\.style\.setProperty\('--crash-x',/);
  assert.match(js,/flying\.style\.setProperty\('--crash-y',/);
  assert.match(js,/stage\.clientWidth\*\.54/);
  assert.match(js,/stage\.clientHeight\*\.43/);
  assert.match(css,/\.crash-page\{\s*height:100%;max-height:100%;min-height:0;overflow:hidden/);
  assert.match(css,/\.crash-flight-rail\{[\s\S]*?rotate\(-23deg\)/);
  assert.match(css,/\.crash-skyline\{[\s\S]*?translate\(var\(--crash-x,0px\),var\(--crash-y,0px\)\)/);
  assert.match(css,/\.crash-available\{\s*display:flex;gap:5px;height:42px;max-height:42px;overflow-x:auto;overflow-y:hidden/);
  assert.match(html,/\/styles\.css\?v=7\.5\.0-crash-ui2/);
  assert.match(html,/\/app\.js\?v=7\.5\.0-crash-ui2/);
});
