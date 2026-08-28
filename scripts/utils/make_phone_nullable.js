/* eslint-disable */
// Telefone deixa de ser obrigatório em users.
//
// Por quê: quem cria a conta pelo Google não informa telefone na hora — o app
// pede depois, na tela "Complete seu cadastro". Enquanto não informa, a coluna
// fica vazia (NULL).
//
// O SQLite não sabe tirar um "NOT NULL" de uma coluna existente, então a tabela
// precisa ser refeita (é o jeito oficial, descrito na documentação do SQLite).
// Aqui a receita é conservadora: copia o CREATE TABLE original, tira só o
// "NOT NULL" do telefone, move os dados, recria os índices e confere as chaves.
//
// Idempotente: se o telefone já aceita vazio, não faz nada.
// Faz uma cópia do banco antes de mexer (sqlite.db.bak-<data>).
//
// Rodar: node scripts/utils/make_phone_nullable.js
//        (DATABASE_PATH aponta outro banco; BACKUP=0 pula a cópia)
const fs = require("fs");
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_PATH || "/app/sqlite.db";
const db = new Database(dbPath);

function phoneEhObrigatorio() {
    const col = db.prepare("PRAGMA table_info(users)").all().find((c) => c.name === "phone");
    if (!col) throw new Error("Tabela users não tem coluna phone — banco inesperado.");
    return col.notnull === 1;
}

if (!phoneEhObrigatorio()) {
    console.log("= telefone já aceita vazio (nada a fazer)");
    db.close();
    process.exit(0);
}

// --- cópia de segurança antes de refazer a tabela -------------------------
if (process.env.BACKUP !== "0") {
    const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
    const destino = `${dbPath}.bak-${carimbo}`;
    db.exec("PRAGMA wal_checkpoint(FULL)");
    fs.copyFileSync(dbPath, destino);
    console.log("+ cópia de segurança em", destino);
}

// --- monta o CREATE TABLE novo a partir do original -----------------------
const sqlOriginal = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get().sql;

// Tira o NOT NULL só da linha do telefone (aceita `phone` com ou sem crase).
const sqlNovo = sqlOriginal
    .replace(/CREATE\s+TABLE\s+(`?)users\1/i, "CREATE TABLE `users_novo_tmp`")
    .replace(/((?:`phone`|phone|"phone"|\[phone\])\s+text)\s+NOT\s+NULL/i, "$1");

if (sqlNovo === sqlOriginal || !/users_novo_tmp/.test(sqlNovo)) {
    throw new Error("Não consegui reescrever o CREATE TABLE de users — abortando sem mexer no banco.");
}
if (/(?:`phone`|phone|"phone"|\[phone\])\s+text\s+NOT\s+NULL/i.test(sqlNovo)) {
    throw new Error("O NOT NULL do telefone continuou no CREATE TABLE — abortando.");
}

// Índices da tabela (menos os automáticos do próprio SQLite), pra recriar depois.
const indices = db
    .prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='users' AND sql IS NOT NULL")
    .all();

const colunas = db
    .prepare("PRAGMA table_info(users)")
    .all()
    .map((c) => `"${c.name}"`)
    .join(", ");

const antes = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;

// Chaves estrangeiras desligadas e "alter table" no modo antigo: sem isso, o
// rename tenta reescrever as outras tabelas que apontam pra users.
db.pragma("foreign_keys = OFF");
db.pragma("legacy_alter_table = ON");

try {
    db.transaction(() => {
        db.exec(sqlNovo);
        db.exec(`INSERT INTO "users_novo_tmp" (${colunas}) SELECT ${colunas} FROM "users"`);
        db.exec(`DROP TABLE "users"`);
        db.exec(`ALTER TABLE "users_novo_tmp" RENAME TO "users"`);
        for (const i of indices) db.exec(i.sql);
    })();
} finally {
    db.pragma("legacy_alter_table = OFF");
    db.pragma("foreign_keys = ON");
}

// --- conferência ----------------------------------------------------------
const depois = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
if (antes !== depois) throw new Error(`Perdi linhas: antes ${antes}, depois ${depois}`);

const problemas = db.prepare("PRAGMA foreign_key_check").all();
if (problemas.length) {
    console.error("!! chaves estrangeiras inconsistentes:", problemas.slice(0, 5));
    throw new Error("foreign_key_check reprovou — restaure a cópia de segurança.");
}
const integridade = db.prepare("PRAGMA integrity_check").get();
if (integridade.integrity_check !== "ok") {
    throw new Error("integrity_check reprovou: " + integridade.integrity_check);
}

if (phoneEhObrigatorio()) throw new Error("telefone continuou obrigatório — algo deu errado.");

console.log(`+ telefone agora aceita vazio (${depois} usuários preservados)`);
console.log("+ índices recriados:", indices.map((i) => i.name).join(", ") || "(nenhum)");

db.close();
