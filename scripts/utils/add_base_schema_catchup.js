/* eslint-disable */
/**
 * "Nivelamento" do banco: tudo que foi criado ENTRE o dump inicial de maio
 * (drizzle/0000) e as migrações leves em `add_*.js`.
 *
 * Por que existe: várias colunas e tabelas que o código usa foram aplicadas
 * direto na VPS, na mão, ou por scripts antigos em TypeScript que não rodam
 * mais no start do container (scripts/migrations/*.ts). Restaurar um backup
 * anterior a essas mudanças subia o app "verde" e quebrava na primeira tela
 * ("no such column: delivered_at"). Este script fecha esse buraco e roda
 * PRIMEIRO no migrate_all.js — os outros scripts dependem dele (ex.: o
 * make_phone_nullable.js recria o índice de e-mail, então `email` precisa
 * existir antes).
 *
 * É idempotente: só cria o que não existe. Em produção, hoje, não faz nada.
 *
 * Rodar: node scripts/utils/add_base_schema_catchup.js
 */
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

function tabelaExiste(nome) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(nome);
}
function colunas(tabela) {
    return new Set(db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name));
}
function garantirColunas(tabela, lista) {
    if (!tabelaExiste(tabela)) {
        console.log(`- tabela ${tabela} não existe, pulando colunas`);
        return;
    }
    const tem = colunas(tabela);
    for (const [nome, ddl] of lista) {
        if (tem.has(nome)) continue;
        db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${nome} ${ddl}`);
        console.log(`+ ${tabela}.${nome} ${ddl}`);
    }
}
function garantirTabela(nome, ddl) {
    if (tabelaExiste(nome)) return;
    db.exec(ddl);
    console.log(`+ tabela ${nome} criada`);
}
function garantirIndice(ddl, nome) {
    db.exec(ddl);
    console.log(`= ${nome} ok`);
}

// ── deliveries: rastreio por token, carimbos de tempo e recibo da entrega ──
garantirColunas("deliveries", [
    ["public_token", "TEXT"],
    ["accepted_at", "TEXT"],
    ["picked_up_at", "TEXT"],
    ["delivered_at", "TEXT"],
    ["receipt_status", "TEXT"],
    ["received_amount", "REAL"],
    ["received_method", "TEXT"],
    ["receipt_note", "TEXT"],
]);
garantirIndice(
    "CREATE UNIQUE INDEX IF NOT EXISTS deliveries_public_token_unique ON deliveries(public_token)",
    "deliveries_public_token_unique"
);

// ── users: e-mail, ativo/inativo, avaliação, trial e chave do PDV ──────────
garantirColunas("users", [
    ["email", "TEXT"],
    ["is_active", "INTEGER DEFAULT 1"],
    ["rating", "REAL DEFAULT 0"],
    ["rating_count", "INTEGER DEFAULT 0"],
    ["rating_delivery", "REAL DEFAULT 0"],
    ["rating_delivery_count", "INTEGER DEFAULT 0"],
    ["trial_ends_at", "TEXT"],
    ["is_trial_user", "INTEGER DEFAULT 0"],
    ["api_key", "TEXT"],
    ["daily_goal", "INTEGER DEFAULT 10"],
]);
garantirIndice(
    "CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email)",
    "users_email_unique"
);

// ── transactions: índices das consultas da carteira ───────────────────────
if (tabelaExiste("transactions")) {
    garantirIndice(
        "CREATE INDEX IF NOT EXISTS transactions_user_created_idx ON transactions(user_id, created_at)",
        "transactions_user_created_idx"
    );
    garantirIndice(
        "CREATE INDEX IF NOT EXISTS transactions_delivery_idx ON transactions(related_delivery_id)",
        "transactions_delivery_idx"
    );
}

// ── tabelas que nasceram depois do dump inicial ───────────────────────────
garantirTabela("reviews", `
    CREATE TABLE reviews (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        delivery_id integer NOT NULL,
        motoboy_id integer NOT NULL,
        shopkeeper_id integer,
        customer_name text,
        rating_general integer NOT NULL,
        rating_delivery integer NOT NULL,
        feedback text,
        created_at text DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
        FOREIGN KEY (motoboy_id) REFERENCES users(id),
        FOREIGN KEY (shopkeeper_id) REFERENCES users(id)
    )`);

garantirTabela("app_logs", `
    CREATE TABLE app_logs (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        level text DEFAULT 'info' NOT NULL,
        event text NOT NULL,
        message text,
        user_id integer,
        page text,
        user_agent text,
        ip text,
        metadata text,
        stack text,
        created_at text DEFAULT CURRENT_TIMESTAMP
    )`);
garantirIndice(
    "CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs(created_at)",
    "idx_app_logs_created_at"
);

garantirTabela("master_products", `
    CREATE TABLE master_products (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        name text NOT NULL,
        type text NOT NULL,
        description text,
        package_name text,
        webhook_url text,
        api_key text NOT NULL,
        is_active integer DEFAULT 1,
        created_at text DEFAULT CURRENT_TIMESTAMP,
        updated_at text DEFAULT CURRENT_TIMESTAMP
    )`);
garantirIndice(
    "CREATE UNIQUE INDEX IF NOT EXISTS master_products_api_key_unique ON master_products(api_key)",
    "master_products_api_key_unique"
);

garantirTabela("master_events", `
    CREATE TABLE master_events (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        product_id integer NOT NULL,
        event text NOT NULL,
        user_id text,
        amount real,
        currency text DEFAULT 'BRL',
        metadata text,
        created_at text DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES master_products(id)
    )`);

garantirTabela("master_notification_settings", `
    CREATE TABLE master_notification_settings (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        event_type text NOT NULL,
        enable_push integer DEFAULT 1,
        enable_email integer DEFAULT 0,
        enable_whatsapp integer DEFAULT 0,
        created_at text DEFAULT CURRENT_TIMESTAMP
    )`);

garantirTabela("push_subscriptions", `
    CREATE TABLE push_subscriptions (
        id integer PRIMARY KEY AUTOINCREMENT,
        user_id integer NOT NULL REFERENCES users(id),
        endpoint text NOT NULL UNIQUE,
        p256dh text NOT NULL,
        auth text NOT NULL,
        user_agent text,
        created_at text DEFAULT CURRENT_TIMESTAMP
    )`);

garantirTabela("password_resets", `
    CREATE TABLE password_resets (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id integer NOT NULL,
        token text NOT NULL,
        expires_at text NOT NULL,
        used_at text,
        created_at text DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
garantirIndice(
    "CREATE UNIQUE INDEX IF NOT EXISTS password_resets_token_unique ON password_resets(token)",
    "password_resets_token_unique"
);

db.close();
console.log("nivelamento ok");
