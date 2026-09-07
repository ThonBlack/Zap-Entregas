// Fechamento diário loja ↔ motoboy ("Resumo do dia").
// Rodar: node scripts/utils/add_daily_closings_table.js
//
// Duas coisas, as duas idempotentes:
//   1. tabela daily_closings (um fechamento por motoboy por dia)
//   2. colunas adjusted_by / adjusted_at em deliveries (quem corrigiu o recibo)
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_PATH || "/app/sqlite.db";
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS daily_closings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shopkeeper_id INTEGER NOT NULL REFERENCES users(id),
    motoboy_id INTEGER NOT NULL REFERENCES users(id),
    day TEXT NOT NULL,
    deliveries_count INTEGER NOT NULL DEFAULT 0,
    fees_total REAL NOT NULL DEFAULT 0,
    cash_total REAL NOT NULL DEFAULT 0,
    pix_total REAL NOT NULL DEFAULT 0,
    card_total REAL NOT NULL DEFAULT 0,
    adjustments_total REAL NOT NULL DEFAULT 0,
    net REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    note TEXT,
    motoboy_note TEXT,
    created_by INTEGER REFERENCES users(id),
    sent_at TEXT,
    responded_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);
console.log("+ tabela daily_closings garantida");

// Um fechamento por motoboy por dia: reenviar depois de editar atualiza a MESMA linha.
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS daily_closings_motoboy_day_idx ON daily_closings(motoboy_id, day)");
db.exec("CREATE INDEX IF NOT EXISTS daily_closings_shop_day_idx ON daily_closings(shopkeeper_id, day)");
console.log("+ índices garantidos (único por motoboy+dia)");

// Correção de recibo pela loja: fica registrado quem mexeu e quando.
const colunas = db.prepare("PRAGMA table_info(deliveries)").all().map((c) => c.name);
for (const [nome, tipo] of [["adjusted_by", "INTEGER"], ["adjusted_at", "TEXT"]]) {
    if (colunas.includes(nome)) {
        console.log(`= ${nome} (já existe)`);
    } else {
        db.exec(`ALTER TABLE deliveries ADD COLUMN ${nome} ${tipo}`);
        console.log(`+ adicionou ${nome} ${tipo} em deliveries`);
    }
}

console.log("\nColunas de daily_closings:");
for (const c of db.prepare("PRAGMA table_info(daily_closings)").all()) {
    console.log(" -", c.name, c.type);
}

db.close();
