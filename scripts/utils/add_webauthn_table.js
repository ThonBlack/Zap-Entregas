/* eslint-disable */
// Tabela do desbloqueio por digital. Rodar: node scripts/utils/add_webauthn_table.js
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_PATH || "/app/sqlite.db";
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    device_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT
)`);
console.log("+ tabela webauthn_credentials garantida");

db.exec("CREATE INDEX IF NOT EXISTS webauthn_user_idx ON webauthn_credentials(user_id)");
console.log("+ índice por usuário garantido");

console.log("\nColunas:");
for (const c of db.prepare("PRAGMA table_info(webauthn_credentials)").all()) {
    console.log(" -", c.name, c.type);
}

db.close();
