import Database from "better-sqlite3";

// Script para criar tabelas do Dashboard Mestre
const dbPath = process.env.DATABASE_PATH || "sqlite.db";
const db = new Database(dbPath);

console.log("Migrando banco de dados para Dashboard Mestre...");

// Tabela master_products
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS master_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            package_name TEXT,
            webhook_url TEXT,
            api_key TEXT NOT NULL UNIQUE,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
    console.log("✅ Tabela master_products criada/verificada!");
} catch (err: any) {
    console.log("⚠️ master_products:", err.message);
}

// Tabela master_events
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS master_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            event TEXT NOT NULL,
            user_id TEXT,
            amount REAL,
            currency TEXT DEFAULT 'BRL',
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES master_products(id)
        )
    `).run();
    console.log("✅ Tabela master_events criada/verificada!");
} catch (err: any) {
    console.log("⚠️ master_events:", err.message);
}

// Tabela master_notification_settings
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS master_notification_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            enable_push INTEGER DEFAULT 1,
            enable_email INTEGER DEFAULT 0,
            enable_whatsapp INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `).run();
    console.log("✅ Tabela master_notification_settings criada/verificada!");
} catch (err: any) {
    console.log("⚠️ master_notification_settings:", err.message);
}

db.close();
console.log("🎉 Migração Dashboard Mestre concluída!");
