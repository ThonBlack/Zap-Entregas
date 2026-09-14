/* eslint-disable */
/**
 * Tipo de cobrança da corrida (deliveries.charge_mode).
 *
 * Antes existia uma régua só: `value > 0` queria dizer "o motoboy cobra do
 * cliente". Só que na vida real tem um terceiro caso — o cliente diz que paga
 * no PIX DA LOJA e o motoboy só CONFERE se caiu antes de entregar (e, se na
 * porta o cliente resolver pagar em dinheiro, aí sim entra na carteira dele).
 *
 * Três valores, sem CHECK (o SQLite guarda enum como TEXT, igual a `status`):
 *   receber  → o motoboy cobra R$ X do cliente na entrega
 *   conferir → o cliente paga no PIX da loja; o motoboy só confere
 *   pago     → não tem nada a receber
 *
 * As linhas que já existem são preenchidas pela régua antiga: value > 0 vira
 * 'receber', o resto vira 'pago'. Assim nada muda de comportamento no dia da
 * subida.
 *
 * Idempotente: rodar duas vezes não altera nada na segunda.
 *
 * Rodar: node scripts/utils/add_charge_mode_column.js
 */
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

const cols = new Set(db.prepare("PRAGMA table_info(deliveries)").all().map((c) => c.name));

if (cols.has("charge_mode")) {
    console.log("= charge_mode (já existe)");
} else {
    db.exec("ALTER TABLE deliveries ADD COLUMN charge_mode TEXT");
    console.log("+ adicionou charge_mode TEXT");
}

// Preenche quem está sem valor: linhas antigas e qualquer linha que tenha
// escapado (INSERT de versão anterior do código). `WHERE charge_mode IS NULL`
// é o que torna isto repetível.
const preenchidas = db
    .prepare(
        `UPDATE deliveries
            SET charge_mode = CASE WHEN COALESCE(value, 0) > 0 THEN 'receber' ELSE 'pago' END
          WHERE charge_mode IS NULL`
    )
    .run().changes;

console.log(
    preenchidas > 0
        ? `+ ${preenchidas} corrida(s) preenchida(s) pela régua antiga (value > 0 = receber)`
        : "= nada a preencher"
);

db.close();
