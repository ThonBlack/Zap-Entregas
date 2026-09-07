/* eslint-disable */
/**
 * Trava no banco contra crédito/débito repetido da mesma corrida.
 *
 * Antes a idempotência de "finalizar entrega" era só ler-e-escrever: duas
 * finalizações ao mesmo tempo liam "ainda não tem crédito" e as duas inseriam,
 * dobrando o que a loja devia ao motoboy.
 *
 * Rodar: node scripts/utils/add_transactions_unique_delivery_index.js
 * É idempotente: pode rodar quantas vezes quiser.
 */
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

// 1) Limpar duplicatas antigas ANTES de criar o índice (senão o CREATE falha).
//    Mantém a MENOR id de cada par (related_delivery_id, type) — a primeira que
//    entrou, que é a legítima.
const duplicatas = db.prepare(`
    SELECT related_delivery_id AS entrega, type AS tipo, COUNT(*) AS quantas, MIN(id) AS manter
      FROM transactions
     WHERE related_delivery_id IS NOT NULL
     GROUP BY related_delivery_id, type
    HAVING COUNT(*) > 1
`).all();

if (duplicatas.length === 0) {
    console.log("= nenhuma transação duplicada por corrida");
} else {
    const apagar = db.prepare(
        "DELETE FROM transactions WHERE related_delivery_id = ? AND type = ? AND id <> ?"
    );
    let total = 0;
    const limpar = db.transaction(() => {
        for (const d of duplicatas) {
            const r = apagar.run(d.entrega, d.tipo, d.manter);
            total += r.changes;
            console.log(
                `  - corrida ${d.entrega} (${d.tipo}): ${d.quantas} linhas, apagadas ${r.changes}, mantida id ${d.manter}`
            );
        }
    });
    limpar();
    console.log(`+ removidas ${total} transações duplicadas em ${duplicatas.length} corrida(s)`);
}

// 2) Índice único PARCIAL: só vale quando a transação pertence a uma corrida.
//    Lançamento manual (acerto, bônus) tem related_delivery_id NULL e pode repetir.
db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS transactions_delivery_type_unique " +
    "ON transactions(related_delivery_id, type) WHERE related_delivery_id IS NOT NULL"
);
console.log("= índice único (related_delivery_id, type) ok");

db.close();
