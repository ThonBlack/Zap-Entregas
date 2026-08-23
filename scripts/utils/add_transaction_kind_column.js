/* eslint-disable */
// Natureza do lançamento na carteira do motoboy + índices do extrato.
// Rodar: node scripts/utils/add_transaction_kind_column.js   (DATABASE_PATH pra apontar outro banco)
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

const cols = new Set(db.prepare("PRAGMA table_info(transactions)").all().map(c => c.name));
if (cols.has("kind")) {
    console.log("= kind (já existe)");
} else {
    db.exec("ALTER TABLE transactions ADD COLUMN kind TEXT NOT NULL DEFAULT 'ajuste'");
    // Os lançamentos antigos são reconhecíveis pela descrição gerada no código.
    const r1 = db.prepare("UPDATE transactions SET kind='corrida' WHERE related_delivery_id IS NOT NULL AND type='credit'").run();
    const r2 = db.prepare("UPDATE transactions SET kind='dinheiro' WHERE related_delivery_id IS NOT NULL AND type='debit'").run();
    console.log(`+ adicionou kind (corrida: ${r1.changes}, dinheiro: ${r2.changes}, resto = ajuste)`);
}
db.exec("CREATE INDEX IF NOT EXISTS transactions_user_created_idx ON transactions(user_id, created_at)");
db.exec("CREATE INDEX IF NOT EXISTS transactions_delivery_idx ON transactions(related_delivery_id)");
console.log("+ índices ok");
db.close();
