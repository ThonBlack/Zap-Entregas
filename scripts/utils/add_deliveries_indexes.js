/* eslint-disable */
/**
 * Índices das consultas quentes + duas travas de unicidade que o código assume
 * e o banco não dava.
 *
 * Hoje, com pouca corrida, nada disso dói. Com um ano de operação (15–20 mil
 * corridas) toda listagem vira varredura da tabela inteira — e o polling do
 * motoboy repete essa varredura a cada 10 segundos.
 *
 * Rodar: node scripts/utils/add_deliveries_indexes.js
 * É idempotente (IF NOT EXISTS + limpeza de duplicata antes dos únicos).
 */
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

function tabelaExiste(nome) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(nome);
}

// ── Índices comuns (não únicos): só aceleram consulta ────────────────────────
const INDICES = [
    ["deliveries", "idx_deliveries_status", "ON deliveries(status)"],
    ["deliveries", "idx_deliveries_motoboy_status", "ON deliveries(motoboy_id, status)"],
    ["deliveries", "idx_deliveries_shop_status", "ON deliveries(shopkeeper_id, status)"],
    ["deliveries", "idx_deliveries_delivered_at", "ON deliveries(delivered_at)"],
    ["transactions", "idx_transactions_user_status", "ON transactions(user_id, status)"],
];

for (const [tabela, nome, corpo] of INDICES) {
    if (!tabelaExiste(tabela)) {
        console.log(`- tabela ${tabela} não existe ainda, pulando ${nome}`);
        continue;
    }
    db.exec(`CREATE INDEX IF NOT EXISTS ${nome} ${corpo}`);
    console.log(`= ${nome} ok`);
}

// ── reviews(delivery_id) único ──────────────────────────────────────────────
// Dois cliques em "Enviar avaliação" viravam duas linhas e a nota do motoboy
// subia duas vezes com uma avaliação só.
if (tabelaExiste("reviews")) {
    const dup = db.prepare(`
        SELECT delivery_id AS entrega, COUNT(*) AS quantas, MIN(id) AS manter
          FROM reviews
         GROUP BY delivery_id
        HAVING COUNT(*) > 1
    `).all();

    if (dup.length) {
        const apagar = db.prepare("DELETE FROM reviews WHERE delivery_id = ? AND id <> ?");
        let total = 0;
        db.transaction(() => {
            for (const d of dup) {
                total += apagar.run(d.entrega, d.manter).changes;
                console.log(`  - corrida ${d.entrega}: ${d.quantas} avaliações, mantida id ${d.manter}`);
            }
        })();
        console.log(`+ removidas ${total} avaliações repetidas`);
    } else {
        console.log("= nenhuma avaliação repetida");
    }

    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS reviews_delivery_unique ON reviews(delivery_id)");
    console.log("= reviews_delivery_unique ok");
}

// ── users(api_key) único (parcial) ──────────────────────────────────────────
// A autenticação do webhook do PDV depende de a chave ser única (findFirst).
// Chave NULA é a maioria dos usuários e pode repetir à vontade.
if (tabelaExiste("users")) {
    const dupKeys = db.prepare(`
        SELECT api_key AS chave, COUNT(*) AS quantas
          FROM users
         WHERE api_key IS NOT NULL
         GROUP BY api_key
        HAVING COUNT(*) > 1
    `).all();

    if (dupKeys.length) {
        // Não dá pra escolher sozinho de quem é a chave: apagar a errada tiraria
        // uma loja do ar. Avisa e não cria o índice — o admin gera chave nova.
        console.error("! ATENÇÃO: existem chaves de API repetidas em users.api_key:");
        for (const d of dupKeys) console.error(`   ${d.chave} usada por ${d.quantas} contas`);
        console.error("! gere chaves novas no painel e rode este script de novo.");
    } else {
        db.exec(
            "CREATE UNIQUE INDEX IF NOT EXISTS users_api_key_unique " +
            "ON users(api_key) WHERE api_key IS NOT NULL"
        );
        console.log("= users_api_key_unique ok");
    }
}

db.close();
