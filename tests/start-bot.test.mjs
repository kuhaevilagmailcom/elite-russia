import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startMessage,startKeyboard,PLAYERS_CHAT_URL} from '../src/bot-ui.mjs';

const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');

test('start greeting is personalized, safe HTML and fits a Telegram photo caption',()=>{
  const greeting=startMessage('<Ivan & Co>');
  assert.match(greeting,/Привет, <b>&lt;Ivan &amp; Co&gt;<\/b>! 👋/);
  assert.match(greeting,/USERNAME/);
  assert.match(greeting,/<blockquote>[\s\S]*Редкие юзернеймы[\s\S]*Рейтинг игроков[\s\S]*Апгрейд[\s\S]*Маркет юзернеймов[\s\S]*<\/blockquote>/);
  assert.match(greeting,/Какой USERNAME выпадет тебе\?/);
  assert.ok([...greeting].length<1024,'Telegram photo captions are limited to 1024 characters');
  assert.doesNotMatch(greeting,/<script|<a href/i);
});

test('empty Telegram first name still gets a natural greeting',()=>{
  assert.match(startMessage(''),/^Привет, <b>игрок<\/b>!/);
});

test('start keyboard contains the game and the correct public players chat',()=>{
  const url='https://t.me/usernamegamebot/usernamegame';
  const keyboard=startKeyboard(url);
  assert.deepEqual(keyboard.inline_keyboard,[
    [{text:'🎮 Играть',url}],
    [{text:'💬 Чат игроков',url:'https://t.me/usernamegamechat'}],
  ]);
  assert.equal(PLAYERS_CHAT_URL,'https://t.me/usernamegamechat');
});

test('no image setup still leaves an accessible players chat button',()=>{
  assert.deepEqual(startKeyboard('').inline_keyboard,[
    [{text:'💬 Чат игроков',url:PLAYERS_CHAT_URL}],
  ]);
});

test('start uses persistent file_id and sends photo with caption, fallbacks to text',()=>{
  assert.match(server,/SELECT value FROM game_config WHERE key=\?/);
  assert.match(server,/telegram_start_photo_file_id/);
  assert.match(server,/telegramApi\('sendPhoto',\{chat_id:chatId,photo,caption,parse_mode:'HTML',reply_markup:keyboard\},12000\)/);
  assert.match(server,/telegramApi\('sendMessage',\{[\s\S]*?chat_id:chatId,text:caption/);
  assert.match(server,/if\(!ADMIN_IDS\.has\(String\(m\.from\?\.id\)\)\)/);
  assert.match(server,/m\.reply_to_message\?\.photo/);
  assert.match(server,/if\(start\)\{[\s\S]*enqueueStart\(db,\{updateId:u\.update_id/);
});
