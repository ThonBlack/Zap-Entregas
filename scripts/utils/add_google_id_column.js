/* eslint-disable */
// Coluna do login com Google. Rodar no container: node scripts/utils/add_google_id_column.js
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_PATH || "/app/sqlite.db";
const db = new Database(dbPath);

const existing = new Set(
    db.prepare("PRAGMA table_info(users)").all().map((c) => c.name)
);

if (existing.has("google_id")) {
    console.log("= google_id (já existe)");
} else {
    db.exec("ALTER TABLE users ADD COLUMN google_id TEXT");
    console.log("+ adicionou google_id TEXT");
}

// Índice único: uma conta Google não pode entrar como dois usuários diferentes.
// Parcial (WHERE NOT NULL) pra não colidir com quem ainda não conectou.
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users(google_id) WHERE google_id IS NOT NULL");
console.log("+ índice único users_google_id_unique garantido");

console.log("\nColunas finais de users:");
for (const c of db.prepare("PRAGMA table_info(users)").all()) {
    console.log(" -", c.name, c.type);
}

db.close();
