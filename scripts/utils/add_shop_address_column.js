// Endereço da loja por extenso, nas Configurações.
//
// Antes só existiam cidade/UF (pra completar endereço que chega sem cidade) e a
// coordenada (pra puxar a busca pra perto). O dono pediu um lugar pra escrever
// o endereço de verdade — "Avenida Leopoldino de Oliveira, 3490 - Centro" — e
// estava digitando isso no campo "Cidade padrão", o que quebrava o geocoder.
//
// Segue a mesma regra de privacidade da coordenada (src/lib/team.ts,
// podeVerLocalDaLoja): só a equipe da loja, a própria loja e o admin veem.
//
// Idempotente: pode rodar quantas vezes for.
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
if (cols.has("shop_address")) {
    console.log("= shop_address (já existe)");
} else {
    db.exec("ALTER TABLE shop_settings ADD COLUMN shop_address TEXT");
    console.log("+ adicionou shop_address TEXT");
}

db.close();
