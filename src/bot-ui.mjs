export const BOT_COMMANDS=Object.freeze([
  {command:'start',description:'Открыть главное меню'},
  {command:'play',description:'Запустить игру'},
  {command:'help',description:'Как играть'}
]);

export const BOT_DESCRIPTION='USERNAME — игра про редкие Telegram-имена. Выбивай уникальные usernames, собирай коллекцию, торгуй и поднимайся в рейтинге.';
export const BOT_SHORT_DESCRIPTION='Коллекционная игра про редкие Telegram-usernames.';

export function escapeTelegramHtml(value){
  return String(value??'').replace(/[&<>]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]));
}

export function startMessage(firstName=''){
  const name=escapeTelegramHtml(String(firstName||'').trim());
  return (name?`Привет, <b>${name}</b>! 👋\n\n`:'')+
    '<b>USERNAME</b> — игра про самые редкие имена Telegram.\n\n'+
    '🎲 Выбивай уникальные usernames\n'+
    '💎 Собирай дорогую коллекцию\n'+
    '📈 Покупай и продавай на рынке\n'+
    '⚡ Рискуй в апгрейдере\n'+
    '🏆 Поднимайся в общем рейтинге\n\n'+
    '<i>Каждый username существует в игре только в одном экземпляре.</i>\n\n'+
    'Нажимай кнопку — и забирай свой первый дроп.';
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

export function gameKeyboard(url,label='🎮 Открыть игру'){
  if(!url)return undefined;
  return {inline_keyboard:[[{text:label,web_app:{url}}]]};
}
