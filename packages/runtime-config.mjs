import { createHash } from "node:crypto";

function publicOrigin(value) {
  if (!value) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

export function normalizedEnv(source = process.env) {
  const env = { ...source };
  const aliases = [
    ["TELEGRAM_BOT_TOKEN", "BOT_TOKEN"],
    ["TELEGRAM_BOT_USERNAME", "BOT_USERNAME"],
    ["TELEGRAM_CUSTODY_CONNECTION_ID", "TELEGRAM_BUSINESS_CONNECTION_ID"],
    ["TELEGRAM_CUSTODY_OWNER_ID", "TELEGRAM_CUSTODY_USER_ID"],
    ["ADMIN_IDS", "ADMIN_TELEGRAM_IDS"],
    ["DB_PATH", "DATABASE_PATH"],
  ];
  for (const [canonical, alias] of aliases) {
    if (env[canonical] && env[alias] && env[canonical] !== env[alias]) {
      throw Error(`Conflicting configuration: ${canonical} and ${alias}`);
    }
    env[canonical] ||= env[alias];
    env[alias] ||= env[canonical];
  }

  // BotHost injects these values itself. Prefer its persistent /app/data
  // storage so a restricted preview can run without an external database.
  const onBotHost = Boolean(env.BOT_ID || env.DOMAIN || env.DATA_DIR);
  if (onBotHost) {
    env.APP_ENV ||= "restricted";
    env.TON_NETWORK ||= "mainnet"; // wallet proof only; no finance enabled
    env.BIND_HOST ||= "0.0.0.0";
    env.APP_URL ||= publicOrigin(env.DOMAIN) || publicOrigin(env.WEBHOOK_URL);
    env.DATABASE_DRIVER ||= "sqlite";
    if (!env.DB_PATH && env.DATA_DIR) {
      env.DB_PATH = `${env.DATA_DIR.replace(/[\\\/]$/, "")}/minion.sqlite`;
      env.DATABASE_PATH = env.DB_PATH;
    }
    if (!env.TELEGRAM_WEBHOOK_SECRET && env.TELEGRAM_BOT_TOKEN) {
      env.TELEGRAM_WEBHOOK_SECRET = createHash("sha256")
        .update(`${env.BOT_ID || env.APP_URL || "bothost"}\0${env.TELEGRAM_BOT_TOKEN}`)
        .digest("hex");
    }
  }
  return env;
}
