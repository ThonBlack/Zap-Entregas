import Database from "better-sqlite3";

// Script para adicionar coluna api_key à tabela users
const dbPath = process.env.DATABASE_PATH || "sqlite.db";
const db = new Database(dbPath);

console.log("Migrando banco de dados para adicionar coluna api_key...");

try {
    db.prepare("ALTER TABLE users ADD COLUMN api_key TEXT").run();
    console.log("✅ Coluna api_key adicionada com sucesso!");
} catch (err: any) {
    if (err.message.includes("duplicate column")) {
        console.log("⏭️ Coluna api_key já existe, pulando...");
    } else {
        throw err;
    }
}

db.close();
console.log("🎉 Migração concluída!");
