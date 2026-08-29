/* eslint-disable */
// Convite do motoboy (uso único, com prazo). Rodar: node scripts/utils/add_invite_token_columns.js
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

const cols = new Set(db.prepare("PRAGMA table_info(users)").all().map(c => c.name));

if (cols.has("invite_token")) {
    console.log("= invite_token (já existe)");
} else {
    db.exec("ALTER TABLE users ADD COLUMN invite_token TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_invite_token_unique ON users(invite_token)");
    console.log("+ adicionou invite_token TEXT + índice único");
}

if (cols.has("invite_token_expires_at")) {
    console.log("= invite_token_expires_at (já existe)");
} else {
    db.exec("ALTER TABLE users ADD COLUMN invite_token_expires_at TEXT");
    console.log("+ adicionou invite_token_expires_at TEXT");
}

db.close();
