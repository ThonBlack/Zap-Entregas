/* eslint-disable */
// Vínculo loja ↔ motoboy (users.shopkeeper_id).
// Rodar: node scripts/utils/add_shopkeeper_id_column.js
//
// Aditivo e repetível: se a coluna já existe, não mexe em nada.
//
// BACKFILL: os motoboys que já estavam no banco antes desta coluna existir
// ficariam com shopkeeper_id NULL — e NULL só o admin enxerga, ou seja, o
// lojista perderia a equipe dele da noite pro dia. Por isso amarramos os
// motoboys órfãos ao lojista dono do PDV (id 2 = Vapor Fume em produção).
// Dá pra mudar por env: BACKFILL_SHOPKEEPER_ID=3 node scripts/utils/add_shopkeeper_id_column.js
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

const DONO_PADRAO = Number(process.env.BACKFILL_SHOPKEEPER_ID || 2);

const cols = new Set(db.prepare("PRAGMA table_info(users)").all().map(c => c.name));

if (cols.has("shopkeeper_id")) {
    console.log("= shopkeeper_id (já existe)");
} else {
    db.exec("ALTER TABLE users ADD COLUMN shopkeeper_id INTEGER REFERENCES users(id)");
    console.log("+ adicionou shopkeeper_id INTEGER");

    const dono = db
        .prepare("SELECT id FROM users WHERE id = ? AND role = 'shopkeeper'")
        .get(DONO_PADRAO);

    if (!dono) {
        console.log(`! backfill pulado: não achei lojista com id ${DONO_PADRAO} (motoboys ficam como 'da casa')`);
    } else {
        const r = db
            .prepare("UPDATE users SET shopkeeper_id = ? WHERE role = 'motoboy' AND shopkeeper_id IS NULL")
            .run(DONO_PADRAO);
        console.log(`+ backfill: ${r.changes} motoboy(s) ligados ao lojista ${DONO_PADRAO}`);
    }
}

db.close();
