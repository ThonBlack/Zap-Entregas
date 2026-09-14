/* eslint-disable */
/**
 * "Quem vê minhas corridas" (shop_settings.pool_mode).
 *
 * Até aqui o pool era sempre aberto: TODA corrida nova aparecia — e podia ser
 * aceita — por qualquer motoboy cadastrado no app, inclusive o de outra loja.
 * Isso é bom quando falta gente e ruim quando a loja tem equipe própria.
 *
 * Dois valores, sem CHECK (o SQLite guarda enum como TEXT):
 *   equipe → só os motoboys da loja (users.shopkeeper_id = a loja). É o PADRÃO.
 *   aberta → qualquer motoboy cadastrado, como era antes.
 *
 * Atenção: o padrão é 'equipe', então esta migração FECHA o pool das lojas que
 * já existem. Foi decisão do dono — "aberta" passa a ser a exceção que a loja
 * liga nas Configurações. Corrida DESTINADA a um motoboy específico continua
 * valendo nos dois modos, e o admin continua enxergando tudo.
 *
 * Idempotente: rodar duas vezes não altera nada na segunda.
 *
 * Rodar: node scripts/utils/add_pool_mode_column.js
 */
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

const existeTabela = !!db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shop_settings'")
    .get();

if (!existeTabela) {
    console.log("- tabela shop_settings não existe, pulando");
    db.close();
    process.exit(0);
}

const cols = new Set(db.prepare("PRAGMA table_info(shop_settings)").all().map((c) => c.name));

if (cols.has("pool_mode")) {
    console.log("= pool_mode (já existe)");
} else {
    db.exec("ALTER TABLE shop_settings ADD COLUMN pool_mode TEXT DEFAULT 'equipe'");
    console.log("+ adicionou pool_mode TEXT DEFAULT 'equipe'");
}

// Linha antiga (ou gravada por versão anterior do código) sem valor: vira
// 'equipe'. O WHERE é o que torna isto repetível.
const preenchidas = db
    .prepare("UPDATE shop_settings SET pool_mode = 'equipe' WHERE pool_mode IS NULL OR pool_mode = ''")
    .run().changes;

console.log(
    preenchidas > 0
        ? `+ ${preenchidas} loja(s) marcada(s) como 'equipe' (padrão)`
        : "= nada a preencher"
);

db.close();
