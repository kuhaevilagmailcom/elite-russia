import test from "node:test";import assert from "node:assert/strict";import {gzipSync} from "node:zlib";import {decodeTgs} from "../packages/tgs.mjs";
const fixture={v:"5.7.0",fr:30,ip:0,op:90,w:512,h:512,layers:[]};
const pack=x=>gzipSync(JSON.stringify(x));
test("Telegram vector TGS decodes into JSON",()=>assert.deepEqual(JSON.parse(decodeTgs(pack(fixture))),fixture));
test("TGS blocks external assets, expressions and oversize decompression",()=>{for(const data of [{...fixture,assets:[{p:"https://example.org/a.png"}]},{...fixture,layers:[{x:"alert(1)"}]},{...fixture,op:2000},{...fixture,extra:"a".repeat(2100000)}])assert.throws(()=>decodeTgs(pack(data)));assert.throws(()=>decodeTgs(Buffer.from("invalid")));});
