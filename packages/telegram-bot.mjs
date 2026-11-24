import { TelegramAPI } from "./telegram.mjs";

export const BOT_COMMANDS = [
  { command: "start", description: "Открыть MINION MARKET" },
  { command: "market", description: "Маркет" },
  { command: "inventory", description: "Мои подарки" },
  { command: "wallet", description: "Кошелёк" },
  { command: "offers", description: "Офферы" },
  { command: "giveaways", description: "Розыгрыши" },
  { command: "profile", description: "Профиль" },
  { command: "support", description: "Поддержка" },
  { command: "help", description: "Помощь" },
];

const commandRoute = (text = "") => {
  const command = text
    .match(/^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i)?.[1]
    ?.toLowerCase();
  return (
    {
      inventory: "inventory",
      wallet: "wallet",
      offers: "offers",
      giveaways: "giveaways",
      profile: "profile",
    }[command] || "market"
  );
};

export class TelegramBotService {
  constructor({ token, appUrl, webhookSecret, fetcher = fetch }) {
    if (!appUrl?.startsWith("https://"))
      throw Error("Bot requires HTTPS APP_URL");
    this.api = new TelegramAPI(token, fetcher);
    this.appUrl = appUrl.replace(/\/$/, "");
    this.webhookSecret = webhookSecret || "";
  }

  async configure() {
    const me = await this.api.call("getMe");
    await this.api.call("setMyCommands", { commands: BOT_COMMANDS });
    await this.api.call("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "Маркет",
        web_app: { url: this.appUrl },
      },
    });
    const webhook = {
      url: `${this.appUrl}/telegram/webhook`,
      allowed_updates: ["message"],
    };
    if (this.webhookSecret) webhook.secret_token = this.webhookSecret;
    await this.api.call("setWebhook", webhook);
    return { username: me.username || null, webhook: true };
  }

  accepts(secret) {
    return !this.webhookSecret || secret === this.webhookSecret;
  }

  async handle(update) {
    const message = update?.message;
    if (message?.chat?.type !== "private" || !message.text?.startsWith("/"))
      return false;
    const route = commandRoute(message.text);
    const url = `${this.appUrl}/?startapp=${encodeURIComponent(route)}`;
    await this.api.call("sendMessage", {
      chat_id: message.chat.id,
      text:
        "MINION MARKET\n\n" +
        "Покупай, продавай и обменивай коллекционные подарки Telegram в одном месте.\n\n" +
        "Подключай кошелёк, собирай свою коллекцию и участвуй в событиях.",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Открыть маркет", web_app: { url } }],
          [
            {
              text: "Мои подарки",
              web_app: { url: `${this.appUrl}/?startapp=inventory` },
            },
            {
              text: "Розыгрыши",
              web_app: { url: `${this.appUrl}/?startapp=giveaways` },
            },
          ],
        ],
      },
    });
    return true;
  }
}
