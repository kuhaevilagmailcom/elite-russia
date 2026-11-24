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
  return env;
}
