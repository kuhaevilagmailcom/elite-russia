import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOTS,LEXICON_STATS,candidateUniverseSize,isValidHandle} from '../src/generator.mjs';

test('mass username lexicon stays above gameplay minimums',()=>{
  assert.ok(ROOTS.length>=120000,`expected >=120000 roots, got ${ROOTS.length}`);
  assert.ok(candidateUniverseSize()>1000000,`expected >1M username candidates, got ${candidateUniverseSize()}`);
  assert.equal(LEXICON_STATS.roots,ROOTS.length);
  for(const word of ['osloeb','govno','zalupa','penis','sanina','babushka','dedushka','andrey','matvey','devil','deer']){
    assert.ok(ROOTS.includes(word),`missing required lexicon entry: ${word}`);
    assert.ok(isValidHandle(word),`required lexicon entry is not a valid handle: ${word}`);
  }
});
