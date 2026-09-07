/* eslint-disable */
// Número do pedido no PDV, pra não criar duas corridas quando o EpicStore reenvia
// o mesmo pedido. Rodar: node scripts/utils/add_external_id_column.js
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

const cols = new Set(db.prepare("PRAGMA table_info(deliveries)").all().map(c => c.name));
if (cols.has("external_id")) {
    console.log("= external_id (já existe)");
} else {
    db.exec("ALTER TABLE deliveries ADD COLUMN external_id TEXT");
    console.log("+ adicionou external_id TEXT");
}

// Índice PARCIAL: só vale quando external_id está preenchido. Assim as corridas
// criadas na mão (sem número de pedido) continuam podendo repetir à vontade,
// e duas chamadas simultâneas do PDV com o mesmo pedido não passam as duas.
db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS deliveries_shopkeeper_external_unique " +
    "ON deliveries(shopkeeper_id, external_id) WHERE external_id IS NOT NULL"
);
console.log("= índice único (shopkeeper_id, external_id) ok");

db.close();
