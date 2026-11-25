import { gunzipSync } from "node:zlib";
// Telegram TGS: bounded gzipped vector Lottie. No expressions or external assets.
export function decodeTgs(buffer){
 if(!Buffer.isBuffer(buffer)||buffer.length>512*1024)throw Error("TGS compressed size invalid");
 const raw=gunzipSync(buffer,{maxOutputLength:2*1024*1024});
 const data=JSON.parse(raw.toString("utf8"));
 if(!data||typeof data!=="object"||!Array.isArray(data.layers)||!Number.isFinite(data.fr)||data.fr<1||data.fr>60||!Number.isFinite(data.ip)||!Number.isFinite(data.op)||data.op<=data.ip||data.op-data.ip>600||!Number.isInteger(data.w)||!Number.isInteger(data.h)||data.w<1||data.h<1||data.w>1024||data.h>1024)throw Error("Invalid TGS composition");
 const stack=[[data,0]];let count=0;
 while(stack.length){const [v,d]=stack.pop();if(++count>150000||d>70)throw Error("TGS complexity limit");
 if(v&&typeof v==="object"){
  if(Array.isArray(v)){for(const x of v)stack.push([x,d+1]);continue;}
  for(const [k,x] of Object.entries(v)){
    if(["__proto__","constructor","prototype"].includes(k)||((k==="x"||k==="expression")&&typeof x==="string")||((k==="u"||k==="p")&&typeof x==="string"&&x.length))throw Error("TGS external resource or expression");
    stack.push([x,d+1]);
  }
 }
 }
 if(Array.isArray(data.assets)&&data.assets.some(a=>a&&(a.p||a.u)))throw Error("TGS image assets not allowed");
 return Buffer.from(JSON.stringify(data));
}
