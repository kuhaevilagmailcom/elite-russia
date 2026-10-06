import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOTS,LEXICON_STATS,candidateUniverseSize,isValidHandle,EXACT_ROOT_VARIANT_UNIVERSE} from '../src/generator.mjs';

test('mass username lexicon stays above gameplay minimums',()=>{
  assert.ok(ROOTS.length>=120000,`expected >=120000 roots, got ${ROOTS.length}`);
  assert.equal(candidateUniverseSize(),EXACT_ROOT_VARIANT_UNIVERSE);
  assert.ok(candidateUniverseSize()>1000000,`expected >1M exact candidates, got ${candidateUniverseSize()}`);
  assert.ok(LEXICON_STATS.realRoots>100000,`expected >100k real roots, got ${LEXICON_STATS.realRoots}`);
  assert.ok(LEXICON_STATS.generatedFallbackRoots<20000,`too many generated fallback roots: ${LEXICON_STATS.generatedFallbackRoots}`);
  assert.equal(LEXICON_STATS.roots,ROOTS.length);
  assert.ok(ROOTS.every(word=>word.length<=15),'lexicon contains a root longer than 15 characters');
  assert.equal(isValidHandle('abcdefghijklmno'),true);
  assert.equal(isValidHandle('abcdefghijklmnop'),false);
  for(const word of ['osloeb','govno','zalupa','penis','sanina','babushka','dedushka','andrey','matvey','devil','deer']){
    assert.ok(ROOTS.includes(word),`missing required lexicon entry: ${word}`);
    assert.ok(isValidHandle(word),`required lexicon entry is not a valid handle: ${word}`);
  }
});
