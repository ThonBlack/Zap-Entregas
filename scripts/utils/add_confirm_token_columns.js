/* eslint-disable */
// Código de conferência do PDV (uso único, com prazo). Rodar: node scripts/utils/add_confirm_token_columns.js
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

const cols = new Set(db.prepare("PRAGMA table_info(deliveries)").all().map(c => c.name));
if (cols.has("confirm_token")) {
    console.log("= confirm_token (já existe)");
} else {
    db.exec("ALTER TABLE deliveries ADD COLUMN confirm_token TEXT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS deliveries_confirm_token_unique ON deliveries(confirm_token)");
    console.log("+ adicionou confirm_token TEXT + índice único");
}
if (cols.has("confirm_token_expires_at")) {
    console.log("= confirm_token_expires_at (já existe)");
} else {
    db.exec("ALTER TABLE deliveries ADD COLUMN confirm_token_expires_at TEXT");
    console.log("+ adicionou confirm_token_expires_at TEXT");
}
db.close();
