/**
 * Sessão da "Fila da loja" (shop_queue_sessions).
 *
 * A fila é a tela que o VENDEDOR abre dentro do painel do EpicStore, por cima
 * da venda, pra conferir e lançar corrida sem ter login no Zap. Quem autoriza
 * ele é esta linha: o EpicStore pede uma sessão com a chave de API da loja e
 * recebe de volta um código que vale 12 horas.
 *
 * Diferente do código de conferência (deliveries.confirm_token), que vale UMA
 * corrida e some ao usar, este vale a LOJA inteira enquanto durar o expediente
 * — por isso mora numa tabela própria, com prazo e dono explícitos.
 *
 * Várias sessões válidas ao mesmo tempo é o normal: a loja tem mais de um PC no
 * balcão e cada um pede a sua.
 *
 * Idempotente: rodar duas vezes não altera nada na segunda.
 *
 * Rodar: node scripts/utils/add_shop_queue_sessions_table.js
 */
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_PATH || "/app/sqlite.db";
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS shop_queue_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    shopkeeper_id INTEGER NOT NULL REFERENCES users(id),
    operator_name TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);
console.log("+ tabela shop_queue_sessions garantida");

// O token é o que a página procura a cada carregamento: sem índice, toda tela
// da fila viraria varredura da tabela inteira. (O UNIQUE acima já cria um, mas
// bancos restaurados de versões intermediárias podem estar sem.)
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS shop_queue_sessions_token_idx ON shop_queue_sessions(token)");
// Apagar as vencidas ao criar uma nova varre por prazo.
db.exec("CREATE INDEX IF NOT EXISTS shop_queue_sessions_expires_idx ON shop_queue_sessions(expires_at)");
console.log("+ índices garantidos (token único, prazo)");

console.log("\nColunas de shop_queue_sessions:");
for (const c of db.prepare("PRAGMA table_info(shop_queue_sessions)").all()) {
    console.log(" -", c.name, c.type);
}

db.close();
