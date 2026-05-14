/* eslint-disable */
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_PATH || "/app/sqlite.db";
const db = new Database(dbPath);

const cols = [
    ["show_customer_name", 1],
    ["show_customer_phone", 1],
    ["show_order_value", 0],
    ["show_observation", 1],
];

const existing = new Set(
    db.prepare("PRAGMA table_info(shop_settings)").all().map((c) => c.name)
);

for (const [name, def] of cols) {
    if (existing.has(name)) {
        console.log("=", name, "(já existe)");
        continue;
    }
    db.exec(`ALTER TABLE shop_settings ADD COLUMN ${name} INTEGER DEFAULT ${def}`);
    console.log("+ adicionou", name, "default", def);
}

console.log("\nColunas finais:");
for (const c of db.prepare("PRAGMA table_info(shop_settings)").all()) {
    console.log(" -", c.name, c.type, "default", c.dflt_value);
}

db.close();
