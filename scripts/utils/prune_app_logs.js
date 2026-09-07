/* eslint-disable */
// Poda da tabela de registros do app (app_logs).
//
// Por quê: todo login grava uma linha "Sessão iniciada" e nada apagava as
// antigas. Com uma loja só isso é irrelevante (centenas de linhas), mas com dez
// lojas a tabela vira o maior objeto do banco e o backup diário (VACUUM INTO)
// fica lento.
//
// O que faz: apaga tudo que tem mais de 90 dias. Repetível — rodar duas vezes
// seguidas não muda nada na segunda vez (a segunda simplesmente não acha nada).
//
// Rodar: node scripts/utils/prune_app_logs.js
//        DATABASE_PATH=./sqlite.db  aponta outro banco
//        LOG_RETENTION_DAYS=180     muda o prazo (padrão 90)
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_PATH || "/app/sqlite.db";
const dias = Number(process.env.LOG_RETENTION_DAYS || 90);

if (!Number.isFinite(dias) || dias < 1) {
    console.error(`!! LOG_RETENTION_DAYS inválido: ${process.env.LOG_RETENTION_DAYS}`);
    process.exit(1);
}

const db = new Database(dbPath);

// Banco novo (ou muito antigo) pode ainda não ter a tabela: não é erro.
const existe = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_logs'")
    .get();

if (!existe) {
    console.log("= app_logs não existe neste banco (nada a podar)");
    db.close();
    process.exit(0);
}

// created_at aparece em dois formatos no banco de produção:
//   "2026-08-22 17:11:34"        (padrão CURRENT_TIMESTAMP do SQLite)
//   "2026-08-22T17:11:34.000Z"   (quando gravado pelo código em ISO)
// Comparar só os 10 primeiros caracteres (a data) funciona nos dois casos.
const corte = db.prepare(`SELECT date('now', ?) AS d`).get(`-${dias} days`).d;

const r = db
    .prepare(
        `DELETE FROM app_logs
          WHERE created_at IS NOT NULL
            AND substr(created_at, 1, 10) < ?`
    )
    .run(corte);

const restantes = db.prepare("SELECT COUNT(*) AS n FROM app_logs").get().n;

if (r.changes > 0) {
    console.log(`+ apagou ${r.changes} registro(s) de app_logs anteriores a ${corte} (${restantes} restantes)`);
} else {
    console.log(`= nada a podar em app_logs (corte ${corte}, ${restantes} registros)`);
}

db.close();
