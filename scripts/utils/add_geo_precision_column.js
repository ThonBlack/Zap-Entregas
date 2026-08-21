/* eslint-disable */
// Guarda o quanto o pino é confiável. Rodar: node scripts/utils/add_geo_precision_column.js
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

const cols = new Set(db.prepare("PRAGMA table_info(deliveries)").all().map(c => c.name));
if (cols.has("geo_precision")) {
    console.log("= geo_precision (já existe)");
} else {
    db.exec("ALTER TABLE deliveries ADD COLUMN geo_precision TEXT");
    console.log("+ adicionou geo_precision TEXT");
}
db.close();
