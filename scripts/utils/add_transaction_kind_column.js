/* eslint-disable */
// Natureza do lançamento na carteira do motoboy + índices do extrato.
// Idempotente e roda no start do container (CMD do Dockerfile) — seguro repetir.
// Rodar na mão: node scripts/utils/add_transaction_kind_column.js  (DATABASE_PATH pra apontar outro banco)
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

db.transaction(() => {
    const cols = new Set(db.prepare("PRAGMA table_info(transactions)").all().map(c => c.name));
    if (!cols.has("kind")) {
        db.exec("ALTER TABLE transactions ADD COLUMN kind TEXT NOT NULL DEFAULT 'ajuste'");
        console.log("+ coluna kind criada");
    }

    // Backfill sempre (idempotente): lançamento ligado a entrega tem natureza conhecida.
    const r1 = db.prepare("UPDATE transactions SET kind='corrida' WHERE related_delivery_id IS NOT NULL AND type='credit' AND kind<>'corrida'").run();
    const r2 = db.prepare("UPDATE transactions SET kind='dinheiro' WHERE related_delivery_id IS NOT NULL AND type='debit' AND kind<>'dinheiro'").run();

    // Lançamentos manuais da tela ANTIGA (até 23/08/2026) tinham o sinal invertido:
    // "Pagar Motoboy" gravava credit (aumentava o que a loja devia). Reconhecíveis
    // pela descrição padrão gerada no código antigo — inverte o tipo e classifica.
    const r3 = db.prepare(`UPDATE transactions SET type='debit', kind='pagamento'
        WHERE related_delivery_id IS NULL AND kind='ajuste' AND type='credit'
          AND description='Pagamento efetuado pelo lojista'`).run();
    const r4 = db.prepare(`UPDATE transactions SET type='credit', kind='pagamento'
        WHERE related_delivery_id IS NULL AND kind='ajuste' AND type='debit'
          AND description='Recebimento do lojista'`).run();

    db.exec("CREATE INDEX IF NOT EXISTS transactions_user_created_idx ON transactions(user_id, created_at)");
    db.exec("CREATE INDEX IF NOT EXISTS transactions_delivery_idx ON transactions(related_delivery_id)");
    console.log(`kind ok (corrida:${r1.changes} dinheiro:${r2.changes} legado pagar:${r3.changes} legado receber:${r4.changes}); índices ok`);
})();
db.close();
