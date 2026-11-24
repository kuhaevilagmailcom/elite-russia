const roles = Object.freeze({
  Owner: ["*"],
  SuperAdmin: ["*"],
  Finance: ["finance.read"],
  Moderator: ["custody.read", "catalog.write"],
  Support: ["support.read"],
  Marketing: ["analytics.read"],
  Analyst: ["analytics.read"],
  ReadOnly: ["analytics.read"],
});
export function rolesFromEnv(env) {
  let configured = {};
  if (env.ADMIN_ROLES_JSON) {
    configured = JSON.parse(env.ADMIN_ROLES_JSON);
    if (
      !configured ||
      Array.isArray(configured) ||
      typeof configured !== "object"
    )
      throw Error("Invalid ADMIN_ROLES_JSON");
  }
  const map = new Map();
  for (const [id, role] of Object.entries(configured)) {
    if (!/^\d{1,16}$/.test(id) || !Object.hasOwn(roles, role))
      throw Error("Invalid administrator role");
    map.set(id, role);
  }
  for (const id of String(env.ADMIN_IDS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)) {
    if (!/^\d{1,16}$/.test(id)) throw Error("Invalid ADMIN_IDS");
    map.set(id, "Owner");
  }
  return map;
}
export function hasPermission(role, permission) {
  return !!roles[role]?.some((x) => x === "*" || x === permission);
}
