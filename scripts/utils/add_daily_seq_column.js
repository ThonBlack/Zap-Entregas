/* eslint-disable */
/**
 * Contador diário das corridas (deliveries.daily_seq).
 *
 * "Corrida 1, 2, 3…" por LOJA, recomeçando do 1 a cada dia. É o costume do
 * grupo de WhatsApp da loja, onde cada corrida do dia é anunciada pelo número —
 * o dono pediu que o app falasse a mesma língua.
 *
 * O dia é o dia de BRASÍLIA. O banco grava as datas em UTC e em dois formatos
 * ("2026-09-14T17:46:09.111Z" do código novo e "2026-09-14 17:46:09" do
 * CURRENT_TIMESTAMP antigo); quem normaliza os dois é o próprio SQLite, com
 * `date(datetime(created_at, '-3 hours'))` — a mesma régua do Resumo do dia.
 *
 * O que este script faz:
 *   1. cria a coluna `daily_seq` (INTEGER, pode ficar vazia);
 *   2. cria o índice (shopkeeper_id, daily_seq), usado na hora de descobrir
 *      qual é o próximo número do dia;
 *   3. numera as corridas que já existem: para cada loja e cada dia, 1..N na
 *      ordem em que foram criadas (empate desfeito pelo id).
 *
 * Rascunho (`draft`) NÃO entra: ainda não é corrida, e ganha número só quando o
 * lojista libera. Cancelada ENTRA — ela existiu, foi anunciada no grupo com um
 * número, e pular esse número deixaria a sequência com buraco inexplicável.
 *
 * Idempotente: só preenche onde `daily_seq` está vazio e continua de onde a
 * numeração do dia parou, então rodar de novo não renumera nada.
 *
 * Rodar: node scripts/utils/add_daily_seq_column.js
 */
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

const existeTabela = !!db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='deliveries'")
    .get();

if (!existeTabela) {
    console.log("- tabela deliveries não existe ainda, pulando");
    db.close();
    process.exit(0);
}

const cols = new Set(db.prepare("PRAGMA table_info(deliveries)").all().map((c) => c.name));

if (cols.has("daily_seq")) {
    console.log("= daily_seq (já existe)");
} else {
    db.exec("ALTER TABLE deliveries ADD COLUMN daily_seq INTEGER");
    console.log("+ adicionou daily_seq INTEGER");
}

// (shopkeeper_id, daily_seq): é por aqui que o app pergunta "qual foi o maior
// número desta loja hoje?" a cada corrida nova.
db.exec(
    "CREATE INDEX IF NOT EXISTS deliveries_shop_day_seq_idx ON deliveries(shopkeeper_id, daily_seq)"
);
console.log("= deliveries_shop_day_seq_idx ok");

// ── Backfill ────────────────────────────────────────────────────────────────
// Só as corridas ainda sem número. A ordem (loja, dia, criação, id) é a mesma
// que a numeração de verdade usa, então o histórico fica igual ao que teria
// saído se a coluna existisse desde o começo.
const semNumero = db
    .prepare(
        `SELECT id,
                shopkeeper_id AS loja,
                date(datetime(created_at, '-3 hours')) AS dia
           FROM deliveries
          WHERE daily_seq IS NULL
            AND status <> 'draft'
            AND shopkeeper_id IS NOT NULL
            AND created_at IS NOT NULL
          ORDER BY shopkeeper_id, dia, datetime(created_at), id`
    )
    .all()
    .filter((l) => l.dia); // created_at ilegível não vira dia nenhum: fica sem número

// Onde a numeração daquele dia parou (0 se ninguém foi numerado ainda). Sem
// isto, rodar o script depois de o app já ter numerado o dia começaria do 1 de
// novo e dois pedidos virariam "Corrida 1".
const topoDoDia = db.prepare(
    `SELECT COALESCE(MAX(daily_seq), 0) AS topo
       FROM deliveries
      WHERE shopkeeper_id = ?
        AND date(datetime(created_at, '-3 hours')) = ?
        AND daily_seq IS NOT NULL`
);

const numerar = db.prepare("UPDATE deliveries SET daily_seq = ? WHERE id = ? AND daily_seq IS NULL");

let preenchidas = 0;
if (semNumero.length) {
    db.transaction(() => {
        const contador = new Map(); // "loja|dia" → último número usado
        for (const linha of semNumero) {
            const chave = `${linha.loja}|${linha.dia}`;
            if (!contador.has(chave)) {
                contador.set(chave, topoDoDia.get(linha.loja, linha.dia).topo);
            }
            const proximo = contador.get(chave) + 1;
            contador.set(chave, proximo);
            preenchidas += numerar.run(proximo, linha.id).changes;
        }
    })();
}

console.log(
    preenchidas > 0
        ? `+ ${preenchidas} corrida(s) numerada(s) por loja e por dia`
        : "= nada a numerar"
);

db.close();
