import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME,USERNAME_RULES,DROP_TIERS} from '../src/config.mjs';
import {TITLE_CONFIG,levelRewards} from '../src/progression.mjs';
import {MINI_GAME_DAILY_CAP} from '../src/minigames.mjs';
import {dailyStatus} from '../src/daily.mjs';
import {todayKey} from '../src/economy.mjs';
import {chanceFor} from '../src/upgrader.mjs';

test('USERNAME 7.1 gameplay constants are consistent',()=>{
  assert.equal(USERNAME_RULES.minLength,4);
  assert.equal(USERNAME_RULES.maxLength,15);
  assert.equal(GAME.transferFee,.05);
  assert.equal(GAME.wheelCooldownMs,24*60*60*1000);
  assert.equal(MINI_GAME_DAILY_CAP,100000);
  assert.equal(Object.values(DROP_TIERS.boosted.weights).reduce((a,b)=>a+b,0),100);
});

test('level titles and free drop rewards use the new progression',()=>{
  const banned=new Set(['Йоу','Чечик','Могёт','Сверхразум']);
  assert.equal(TITLE_CONFIG.some(([,title])=>banned.has(title)),false);
  const map=new Map(levelRewards().map(x=>[x.level,x]));
  assert.equal(map.get(15)?.freeDrops,5);
  assert.equal(map.get(70)?.freeDrops,10);
});

test('daily reward cycles back after day seven',()=>{
  const today=todayKey(),d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-1);
  const yesterday=d.toISOString().slice(0,10);
  const s=dailyStatus(null,{daily_streak:7,last_daily_date:yesterday});
  assert.equal(s.nextStreak,8);
  assert.equal(s.day,1);
});

test('upgrade chance starts high for a small value increase and falls for expensive targets',()=>{
  const near=chanceFor(10000,10200),far=chanceFor(10000,50000);
  assert.ok(near>=.8&&near<=.92);
  assert.ok(far<near);
  assert.ok(far<.3);
});
