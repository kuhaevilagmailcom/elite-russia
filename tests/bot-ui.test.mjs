import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BOT_COMMANDS,BOT_DESCRIPTION,BOT_SHORT_DESCRIPTION,startMessage,helpMessage,gameKeyboard} from '../src/bot-ui.mjs';

const serverSrc=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');

test('bot exposes player and admin commands',()=>{
  assert.deepEqual(BOT_COMMANDS.map(x=>x.command),['start','play','help','admin','broadcast']);
  assert.ok(BOT_COMMANDS.every(x=>x.description.length>0));
});

test('start message is branded, useful and safely escapes Telegram HTML',()=>{
  const text=startMessage('<Alex & Co>');
  assert.match(text,/<b>USERNAME<\/b>/);
  assert.match(text,/&lt;Alex &amp; Co&gt;/);
  assert.match(text,/Каждый username существует/);
  assert.doesNotMatch(text,/<Alex/);
});

test('help explains the core loop and includes commands',()=>{
  const text=helpMessage();
  for(const token of ['бесплатный дроп','коллекции','апгрейдер','/start','/play','/help'])assert.match(text,new RegExp(token,'i'));
});

test('game button opens the configured Telegram Mini App link',()=>{
  assert.deepEqual(gameKeyboard('https://t.me/usernamegamebot/usernamegame'),{inline_keyboard:[[{text:'🎮 Начать играть',url:'https://t.me/usernamegamebot/usernamegame'}]]});
  assert.equal(gameKeyboard(''),undefined);
});

test('bot profile and permanent game menu are configured on startup',()=>{
  assert.ok(BOT_DESCRIPTION.length<=512);
  assert.ok(BOT_SHORT_DESCRIPTION.length<=120);
  for(const method of ['setMyCommands','setMyDescription','setMyShortDescription','setChatMenuButton'])assert.match(serverSrc,new RegExp(method));
  assert.match(serverSrc,/type:'web_app',text:'🎮 Начать играть'/);
  assert.match(serverSrc,/MINIAPP_LINK=process\.env\.MINIAPP_LINK\|\|'https:\/\/t\.me\/usernamegamebot\/usernamegame'/);
  assert.match(serverSrc,/WEBAPP_URL must be a public HTTPS URL/);
});

test('admins receive a restart message immediately after the active bot process starts',()=>{
  assert.match(serverSrc,/async function notifyAdminsBotRestarted/);
  assert.match(serverSrc,/Бот перезапущен/);
  assert.match(serverSrc,/Версия:/);
  assert.match(serverSrc,/await notifyAdminsBotRestarted\(\);\s*await configureTelegramBot\(\)/);
});
