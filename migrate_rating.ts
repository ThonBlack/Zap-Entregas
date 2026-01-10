import Database from "better-sqlite3";

// Script para adicionar colunas de rating à tabela users
const dbPath = process.env.DATABASE_PATH || "sqlite.db";
const db = new Database(dbPath);

console.log("Migrando banco de dados para adicionar colunas de rating...");

try {
    // Adicionar colunas de rating se não existirem
    const columns = [
        "ALTER TABLE users ADD COLUMN rating REAL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN rating_count INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN rating_delivery REAL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN rating_delivery_count INTEGER DEFAULT 0"
    ];

    for (const sql of columns) {
        try {
            db.prepare(sql).run();
            console.log(`✅ ${sql.split("ADD COLUMN")[1]?.trim().split(" ")[0]} adicionada`);
        } catch (err: any) {
            if (err.message.includes("duplicate column")) {
                console.log(`⏭️ Coluna já existe, pulando...`);
            } else {
                throw err;
            }
        }
    }

    // Criar tabela reviews se não existir
    db.prepare(`
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            delivery_id INTEGER NOT NULL REFERENCES deliveries(id),
            motoboy_id INTEGER NOT NULL REFERENCES users(id),
            shopkeeper_id INTEGER REFERENCES users(id),
            customer_name TEXT,
            rating_general INTEGER NOT NULL,
            rating_delivery INTEGER NOT NULL,
            feedback TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
    console.log("✅ Tabela reviews criada/verificada");

    console.log("\n🎉 Migração concluída com sucesso!");
} catch (error) {
    console.error("Erro na migração:", error);
}

db.close();
