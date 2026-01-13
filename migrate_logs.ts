import Database from "better-sqlite3";

// Script para criar tabela de logs para monitoramento em produção
const dbPath = process.env.DATABASE_PATH || "sqlite.db";
const db = new Database(dbPath);

console.log("Criando tabela app_logs para monitoramento...");

try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS app_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT NOT NULL DEFAULT 'info',
            event TEXT NOT NULL,
            message TEXT,
            user_id INTEGER,
            page TEXT,
            user_agent TEXT,
            ip TEXT,
            metadata TEXT,
            stack TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
    console.log("✅ Tabela app_logs criada/verificada!");

    // Criar índice para busca por data
    db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs(created_at)
    `).run();
    console.log("✅ Índice criado!");

} catch (err: any) {
    console.log("⚠️ app_logs:", err.message);
}

db.close();
console.log("🎉 Migração de logs concluída!");
