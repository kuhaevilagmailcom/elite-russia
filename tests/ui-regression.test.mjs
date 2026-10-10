import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('official icon font is loaded before local styles',()=>{
  const icons=html.indexOf('https://use.hugeicons.com/font/icons.css');
  const styles=html.indexOf('/styles.css?');
  assert.ok(icons>0&&icons<styles,'Hugeicons stylesheet must be loaded');
});

test('menu and page icons retain expected Hugeicons markup',()=>{
  assert.match(app,/const ICON_NAME=Object\.freeze\(/);
  assert.match(app,/function icon\(k\).*hugeicon hgi-stroke hgi-/);
  assert.match(app,/function iconRaw\(name\).*hugeicon hgi-stroke hgi-/);
  assert.doesNotMatch(app,/ICON_PATH=Object\.freeze/);
  for(const name of ['home','menu','market','wheel','tasks','collection','profile','shop','settings','filter','back','close']){
    assert.match(app,new RegExp('\\b'+name+':\\x27'));
  }
  assert.match(css,/\.ico\{font-size:20px;line-height:1;display:inline-grid;place-items:center\}/);
});

test('CSS guards do not force small Telegram screens to 520px',()=>{
  assert.match(css,/#app,\.shell\{min-height:0\}/);
  assert.match(css,/@media\(max-height:520px\)/);
  assert.match(css,/\.modal,\.drop-cost-sheet\{max-height:calc\(/);
});

test('HTML busts frontend asset caches after the repair',()=>{
  assert.match(html,/\/app\.js\?v=7\.5\.0-ui-fix1/);
  assert.match(html,/\/styles\.css\?v=7\.5\.0-ui-fix1/);
  assert.match(html,/\/admin\.css\?v=7\.5\.0-ui-fix1/);
});
