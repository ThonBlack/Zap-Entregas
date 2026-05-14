/* eslint-disable */
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_PATH || "/app/sqlite.db";
const db = new Database(dbPath);

const cols = [
    ["default_city", "TEXT", "NULL"],
    ["default_state", "TEXT", "NULL"],
    ["shop_lat", "REAL", "NULL"],
    ["shop_lng", "REAL", "NULL"],
];

const existing = new Set(
    db.prepare("PRAGMA table_info(shop_settings)").all().map((c) => c.name)
);

for (const [name, type, def] of cols) {
    if (existing.has(name)) {
        console.log("=", name, "(já existe)");
        continue;
    }
    db.exec(`ALTER TABLE shop_settings ADD COLUMN ${name} ${type} DEFAULT ${def}`);
    console.log("+ adicionou", name, type);
}

console.log("\nColunas finais:");
for (const c of db.prepare("PRAGMA table_info(shop_settings)").all()) {
    console.log(" -", c.name, c.type);
}

db.close();
