const fs = require("fs");
const path = require("path");

const blocked = [".env", "secrets.json", "config.json"];
let failed = false;

function walk(dir) {
  for (const item of fs.readdirSync(dir)) {
    if (item === ".git" || item === "node_modules") continue;

    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (blocked.includes(item)) {
      console.error("Blocked file found:", full);
      failed = true;
    }

    if (stat.isDirectory()) walk(full);
  }
}

walk(process.cwd());

if (failed) {
  process.exit(1);
}

console.log("Public file check passed.");
