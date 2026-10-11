import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('home stake button uses a single aligned chevron independent of icon fonts',()=>{
  const home=app.match(/function homeView\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(home,/drop-price-chevron/);
  assert.doesNotMatch(home,/icon\('down'\)/);
  assert.match(css,/\.drop-price-v7 \.drop-price-chevron\{[\s\S]*?border-right:2px solid var\(--muted\)/);
  assert.match(css,/\.drop-price-v7 \.drop-price-chevron\{[\s\S]*?rotate\(45deg\)/);
  assert.match(css,/\.home-stake-top \.drop-price-v7\{position:static/);
});

test('admin section is present in account menu only for confirmed admins',()=>{
  const menu=app.match(/function menuHtml\(\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.match(menu,/s\.title==='Аккаунт'&&state\.user\?\.isAdmin/);
  assert.match(menu,/\[\['admin','admin','Админка'\]\]/);
  assert.match(menu,/state\.user\?\.isAdmin\?'<button class="menu-admin-shortcut"/);
  assert.doesNotMatch(menu,/state\.isDesktop|isMobile|is-desktop/);
});

test('a verified admin remains an admin after a normal drop payload without role',()=>{
  const fn=app.match(/function applyUserLocal\(user\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(fn,'missing applyUserLocal()');
  const state={
    user:{id:10,telegramId:'123456',balance:50000,isAdmin:true,unreadNotifications:3},
    home:{user:null}
  };
  const context={state,applyPreferences(){}};
  vm.runInNewContext(fn+'; applyUserLocal({id:10,telegramId:"123456",balance:25000})',context);
  assert.equal(state.user.balance,25000);
  assert.equal(state.user.isAdmin,true);
  assert.equal(state.user.unreadNotifications,3);
  assert.equal(state.home.user.isAdmin,true);
  // Switching account may NEVER inherit admin status.
  vm.runInNewContext('applyUserLocal({id:11,telegramId:"654321",balance:1000})',context);
  assert.notEqual(state.user.isAdmin,true);
  vm.runInNewContext('applyUserLocal({id:11,telegramId:"654321",isAdmin:false,balance:1000})',context);
  assert.equal(state.user.isAdmin,false);
});

test('admin module is retryable and its first-load errors are logged',()=>{
  assert.match(app,/async function fetchPage\(page\)/);
  assert.match(app,/if\(page==='admin'\)\{[\s\S]*?await ensureAdminUi\(\)/);
  assert.match(app,/function ensureAdminUi\(\)/);
  assert.match(app,/console\.error\('USERNAME admin module failed to load:'/);
  assert.match(html,/\/app\.js\?v=7\.5\.0-[a-z0-9-]+/);
  assert.match(html,/\/styles\.css\?v=7\.5\.0-[a-z0-9-]+/);
});
