import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('desktop Telegram WebApp menu does not use viewport width percentage',()=>{
  assert.doesNotMatch(css,/html\.is-desktop \.menu-sheet\{width:min\(390px,38vw\)\}/);
  assert.match(css,/html\.is-desktop \.menu-sheet\{[\s\S]*?width:min\(360px,calc\(100% - 24px\)\)/);
  assert.match(css,/html\.is-desktop \.menu-sheet\{[\s\S]*?overflow-y:auto/);
});

test('desktop menu has two readable columns, horizontal icon and full label',()=>{
  assert.match(css,/html\.is-desktop \.menu-section>div\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/html\.is-desktop \.menu-section-tile\{[\s\S]*?flex-direction:row/);
  assert.match(css,/html\.is-desktop \.menu-tile-label\{[\s\S]*?white-space:normal/);
  assert.match(css,/html\.is-desktop \.menu-tile-label\{[\s\S]*?font-size:12px/);
  assert.match(app,/MENU_SECTIONS=\[/);
  for(const label of ['Апгрейдер','Коллекция','Уведомления','Настройки'])
    assert.ok(app.includes(label),label+' is missing from the menu');
});

test('narrow desktop popup can shrink to Telegram WebApp available height',()=>{
  assert.match(css,/@media \(max-width:600px\)\{/);
  assert.match(css,/html\.is-desktop \.shell\{\s*width:100%;height:calc\(var\(--app-h\) - 16px\);\s*min-height:0/);
  assert.match(css,/html\.is-desktop \.topbar\{padding-left:12px;padding-right:12px\}/);
});

test('desktop-only menu overrides leave phone menu CSS intact',()=>{
  assert.match(css,/\.menu-section>div\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/\.menu-tile-label\{font-size:11px;font-weight:650;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
  assert.match(css,/html\.is-desktop \.menu-section>div/);
  assert.match(html,/\/styles\.css\?v=7\.5\.0-[a-z0-9-]+/);
});
