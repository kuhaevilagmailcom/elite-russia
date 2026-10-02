import test from 'node:test';
import assert from 'node:assert/strict';

test('economy constants are sane',()=>{
  const start=100000, search=1000, firstCarMax=100000;
  assert.ok(start/search>=50);
  assert.ok(firstCarMax<=start);
});

test('dealer tiers progress gradually',()=>{
  const unlocked=l=>l>=15?5:l>=10?4:l>=6?3:l>=3?2:1;
  assert.equal(unlocked(1),1);
  assert.equal(unlocked(3),2);
  assert.equal(unlocked(6),3);
  assert.equal(unlocked(10),4);
  assert.equal(unlocked(15),5);
});
