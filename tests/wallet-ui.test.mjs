import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const source=readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
const block=source.slice(source.indexOf("let proofListener;"),source.indexOf("let busy = false;"));
function setup({restored=false,fail=false}={}){
 const calls=[],modal={open:true,close(){this.open=false;calls.push("native-close");}};
 const ctx={modal,location:{protocol:"https:",origin:"https://test.invalid"},tonUI:null,esc:x=>String(x),btn:(...x)=>x[0],toast:x=>calls.push(x),
 show:(title,body)=>{assert.notEqual(ctx.tonUI?.modalState?.status,"opened");modal.open=true;calls.push(body);},
 api:async(path)=>{calls.push(path);if(path==="wallet/connection")return {enabled:true,network:"-239",connection:restored?{address:"0:abc",network:"-239"}:null};if(path.endsWith("challenge"))return {payload:"challenge"};if(path.endsWith("verify")){if(fail)throw Error("bad signature");return {address:"0:abc"};}},
 window:{TON_CONNECT_UI:{TonConnectUI:class{
 constructor(){this.modalState={status:"closed"};this.connectionRestored=Promise.resolve();this.connected=restored;this.wallet=restored?{account:{address:"0:abc",chain:"-239"}}:null;}
 setConnectRequestParameters(){}
 onStatusChange(fn){this.callback=fn;return ()=>{this.callback=null;};}
 async openModal(){assert.equal(modal.open,false);this.modalState.status="opened";calls.push("sdk-open");}
 closeModal(){this.modalState.status="closed";calls.push("sdk-close");}
 }}}
 };
 vm.createContext(ctx);vm.runInContext(block,ctx);
 return {ctx,calls,modal,connect:()=>vm.runInContext("connect()",ctx),wallet:{account:{address:"0:abc",chain:"-239"},connectItems:{tonProof:{proof:{}}}}};
}
test("native sheet never overlays SDK; verification result appears after SDK closes",async()=>{
 const s=setup();await s.connect();assert.equal(s.modal.open,false);assert.equal(s.ctx.tonUI.modalState.status,"opened");await s.connect();assert.equal(s.calls.filter(x=>x==="sdk-open").length,1);
 await s.ctx.tonUI.callback(s.wallet);assert.equal(s.ctx.tonUI.modalState.status,"closed");assert.equal(s.modal.open,true);assert(s.calls.some(x=>x.includes("Подпись проверена сервером")));
});
test("proof failure closes picker and presents retry without disconnecting a verified wallet",async()=>{
 const s=setup({fail:true});await s.connect();await s.ctx.tonUI.callback(s.wallet);assert.equal(s.ctx.tonUI.modalState.status,"closed");assert(s.calls.some(x=>x.includes("bad signature")&&x.includes("Повторить подключение")));
});
test("already verified restored connection does not open picker",async()=>{
 const s=setup({restored:true});await s.connect();assert(!s.calls.includes("sdk-open"));assert(s.calls.some(x=>x.includes("Mainnet")));
});
