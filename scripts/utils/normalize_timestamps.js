/* eslint-disable */
/**
 * Padroniza as datas antigas do banco no formato ISO.
 *
 * O problema: `CURRENT_TIMESTAMP` do SQLite grava "2026-08-21 16:08:38", enquanto
 * o código grava "2026-08-21T16:08:38.000Z". No SQLite a comparação é de TEXTO e
 * o espaço (0x20) vem antes do "T" (0x54) — então comparar as duas formas dava
 * sempre falso. Isso matava a trava contra duplo clique, a contagem do plano no
 * dia 1 do mês, o aviso de corrida nova e bagunçava a ordem do histórico.
 *
 * O código já foi corrigido (compara via `datetime(coluna)` e grava sempre ISO).
 * Este script arruma o que ficou pra trás.
 *
 * Converte SÓ as linhas no formato antigo exato "YYYY-MM-DD HH:MM:SS"
 * (10 + espaço + 8 caracteres) para "YYYY-MM-DDTHH:MM:SS.000Z". Linha já em ISO,
 * vazia ou em qualquer outro formato não é tocada — por isso rodar de novo não
 * muda mais nada.
 *
 * Rodar: node scripts/utils/normalize_timestamps.js
 */
const Database = require("better-sqlite3");
const db = new Database(process.env.DATABASE_PATH || "/app/sqlite.db");

// tabela → colunas de data. Só o que existe no schema (src/db/schema.ts).
const COLUNAS_DE_DATA = {
    users: ["created_at", "last_avatar_update", "last_location_update", "trial_ends_at", "invite_token_expires_at"],
    deliveries: ["created_at", "updated_at", "accepted_at", "picked_up_at", "delivered_at", "adjusted_at", "confirm_token_expires_at"],
    push_subscriptions: ["created_at"],
    transactions: ["created_at"],
    financial_records: ["created_at"],
    shop_settings: ["updated_at"],
    webauthn_credentials: ["created_at", "last_used_at"],
    subscriptions: ["created_at", "current_period_start", "current_period_end"],
    reviews: ["created_at"],
    master_products: ["created_at", "updated_at"],
    master_events: ["created_at"],
    master_notification_settings: ["created_at"],
    app_logs: ["created_at"],
    password_resets: ["created_at", "expires_at", "used_at"],
    daily_closings: ["created_at", "updated_at", "sent_at", "responded_at"],
};

function tabelaExiste(nome) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(nome);
}

function colunaExiste(tabela, coluna) {
    return db.prepare(`PRAGMA table_info(${tabela})`).all().some((c) => c.name === coluna);
}

let totalGeral = 0;

for (const [tabela, colunas] of Object.entries(COLUNAS_DE_DATA)) {
    if (!tabelaExiste(tabela)) continue;

    for (const coluna of colunas) {
        if (!colunaExiste(tabela, coluna)) continue;

        // GLOB casa o formato antigo caractere a caractere: "2026-08-21 16:08:38".
        // O "T" na posição 11 impede que uma linha já em ISO seja tocada.
        const r = db.prepare(`
            UPDATE ${tabela}
               SET ${coluna} = replace(${coluna}, ' ', 'T') || '.000Z'
             WHERE ${coluna} IS NOT NULL
               AND ${coluna} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'
        `).run();

        if (r.changes > 0) {
            console.log(`  + ${tabela}.${coluna}: ${r.changes} linha(s) normalizada(s)`);
            totalGeral += r.changes;
        }
    }
}

console.log(
    totalGeral === 0
        ? "= todas as datas já estavam no formato ISO"
        : `= ${totalGeral} data(s) convertida(s) pro formato ISO`
);

db.close();
