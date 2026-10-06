import {ROOTS,SUFFIXES,PREFIXES,EXACT_ROOT_VARIANT_UNIVERSE} from '../src/generator.mjs';
import {USERNAME_RULES} from '../src/config.mjs';

function normalize(handle){
  let h=String(handle||'').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,USERNAME_RULES.maxLength);
  if(h.length<USERNAME_RULES.minLength)h=(h+'name').slice(0,USERNAME_RULES.minLength);
  if(!/[a-z]/.test(h))h='u'+h.slice(0,USERNAME_RULES.maxLength-1);
  return h;
}
const unique=new Set();
for(const root of ROOTS){
  for(const suffix of SUFFIXES)unique.add(normalize(root+suffix));
  for(const prefix of PREFIXES.slice(1))unique.add(normalize(prefix+root));
}
console.log(JSON.stringify({roots:ROOTS.length,exactUniqueRootVariants:unique.size,expected:EXACT_ROOT_VARIANT_UNIVERSE},null,2));
if(unique.size!==EXACT_ROOT_VARIANT_UNIVERSE){
  console.error('Username universe drift:',unique.size,'!=',EXACT_ROOT_VARIANT_UNIVERSE);
  process.exit(1);
}
if(unique.size<1000000){
  console.error('Username universe is below 1,000,000');
  process.exit(1);
}
