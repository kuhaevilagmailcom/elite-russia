export const BOT_COMMANDS=Object.freeze([
  {command:'start',description:'Открыть главное меню'},
  {command:'play',description:'Начать играть'},
  {command:'help',description:'Как играть'},
  {command:'admin',description:'Админ-панель'},
  {command:'broadcast',description:'Рассылка (только админ)'}
]);

export const BOT_DESCRIPTION='USERNAME — игра про редкие Telegram-имена. Выбивай уникальные usernames, собирай коллекцию, торгуй и поднимайся в рейтинге.';
export const BOT_SHORT_DESCRIPTION='Коллекционная игра про редкие Telegram-usernames.';

export function escapeTelegramHtml(value){
  return String(value??'').replace(/[&<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]));
}

export function startMessage(firstName=''){
  const name=escapeTelegramHtml(String(firstName||'игрок').trim().slice(0,64)||'игрок');
  return 'Привет, <b>'+name+'</b>! 👋\n\n'+
    '<b>USERNAME</b> — крути юзернеймы и собирай самые дорогие.\n\n'+
    '<blockquote>💎 <b>Редкие юзернеймы</b> — пополняй коллекцию\n'+
    '🏆 <b>Рейтинг игроков</b> — поднимайся в топ\n'+
    '⚡ <b>Апгрейд</b> — улучшай свои находки\n'+
    '🛒 <b>Маркет юзернеймов</b> — покупай и продавай</blockquote>\n\n'+
    'Какой USERNAME выпадет тебе? Жми <b>«Играть»</b> 👇';
}

export const PLAYERS_CHAT_URL='https://t.me/usernamegamechat';

export function startKeyboard(url){
  return {inline_keyboard:[
    ...(url?[[{text:'🎮 Играть',url}]]:[]),
    [{text:'💬 Чат игроков',url:PLAYERS_CHAT_URL}]
  ]};
}

export function helpMessage(){
  return '<b>Как играть в USERNAME</b>\n\n'+
    '1. Открой игру и забери бесплатный дроп.\n'+
    '2. Оставь username в коллекции или продай его.\n'+
    '3. Торгуй с игроками и собирай редкие короткие имена.\n'+
    '4. Используй апгрейдер, если готов рискнуть предметом ради более дорогого.\n'+
    '5. Увеличивай капитал и занимай место в рейтинге.\n\n'+
    'Команды: /start — главное меню, /play — открыть игру, /help — эта подсказка.';
}

export function gameKeyboard(url,label='🎮 Начать играть'){
  if(!url)return undefined;
  return {inline_keyboard:[[{text:label,url}]]};
}
