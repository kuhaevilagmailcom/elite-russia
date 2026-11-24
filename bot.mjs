import { TelegramBotService } from "./packages/telegram-bot.mjs";
import { normalizedEnv } from "./packages/runtime-config.mjs";

const env = normalizedEnv();
const bot = new TelegramBotService({
  token: env.TELEGRAM_BOT_TOKEN,
  appUrl: env.APP_URL,
  webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
});
const result = await bot.configure();
console.log(`Telegram bot configured: @${result.username || "unknown"}; webhook enabled`);
