/**
 * Testes do encadeador de migrações (scripts/utils/migrate_all.js).
 *
 * Duas garantias, e as duas já custaram caro antes:
 *
 *  (a) Nenhum `add_*.js` fica de fora da lista. Antes a ordem morava numa linha
 *      do Dockerfile; seis scripts existiam na pasta e nunca rodavam. Se alguém
 *      criar um script novo e esquecer de acrescentar, este teste falha.
 *
 *  (b) Rodar duas vezes seguidas não muda o banco. É o que acontece de verdade:
 *      o container roda as migrações a cada boot, e o banco de produção já tem
 *      quase tudo. A prova é feita num banco descartável, criado do zero a
 *      partir do esquema mais antigo do projeto (drizzle/0000) — ou seja, o
 *      teste também prova que restaurar um backup velho sobe sem quebrar.
 *
 * Rodar:  npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require_ = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pastaUtils = path.join(raiz, "scripts", "utils");

const { ORDEM, NAO_SAO_MIGRACAO } = require_(path.join(pastaUtils, "migrate_all.js"));

// --- (a) a lista não pode esquecer ninguém --------------------------------

test("todo script add_*.js da pasta está na lista do migrate_all", () => {
    const naPasta = fs
        .readdirSync(pastaUtils)
        .filter((f) => f.startsWith("add_") && f.endsWith(".js"))
        .sort();

    const naLista = new Set(ORDEM.map((e) => e.arquivo));
    const esquecidos = naPasta.filter(
        (f) => !naLista.has(f) && !NAO_SAO_MIGRACAO.includes(f)
    );

    assert.deepEqual(
        esquecidos,
        [],
        `Script(s) de migração criados e nunca chamados: ${esquecidos.join(", ")}.\n` +
        `Acrescente em scripts/utils/migrate_all.js (ORDEM), na posição certa:\n` +
        `mexe em "users"? antes de make_phone_nullable.js. Senão, depois.`
    );
});

test("a lista não aponta pra arquivo obrigatório que não existe", () => {
    const faltando = ORDEM.filter(
        (e) => !e.opcional && !fs.existsSync(path.join(pastaUtils, e.arquivo))
    ).map((e) => e.arquivo);

    assert.deepEqual(faltando, [], `Na lista mas não existe na pasta: ${faltando.join(", ")}`);
});

test("make_phone_nullable roda depois de tudo que mexe em users", () => {
    const nomes = ORDEM.map((e) => e.arquivo);
    const iRefaz = nomes.indexOf("make_phone_nullable.js");
    assert.ok(iRefaz > 0, "make_phone_nullable.js precisa estar na lista");

    // Refazer a tabela users recria os índices que existem NAQUELE momento —
    // o índice único do login com Google é o caso concreto.
    for (const dependente of ["add_google_id_column.js", "add_webauthn_table.js"]) {
        assert.ok(
            nomes.indexOf(dependente) < iRefaz,
            `${dependente} tem que vir antes de make_phone_nullable.js`
        );
    }
});

// --- (b) rodar duas vezes não muda nada -----------------------------------

/** Cria um banco descartável com o esquema mais antigo do projeto. */
function bancoDoZero(destino) {
    const Database = require_("better-sqlite3");
    const sql = fs.readFileSync(path.join(raiz, "drizzle", "0000_huge_nebula.sql"), "utf8");
    const db = new Database(destino);
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec(sql.split("--> statement-breakpoint").join(";"));
    db.close();
}

/** Retrato do banco: esquema completo + quantas linhas tem cada tabela. */
function retrato(caminho) {
    const Database = require_("better-sqlite3");
    const db = new Database(caminho, { readonly: true });
    const objetos = db
        .prepare("SELECT type, name, sql FROM sqlite_master ORDER BY type, name")
        .all();
    const contagens = {};
    for (const o of objetos) {
        if (o.type !== "table" || o.name.startsWith("sqlite_")) continue;
        contagens[o.name] = db.prepare(`SELECT COUNT(*) AS n FROM "${o.name}"`).get().n;
    }
    db.close();
    return { objetos, contagens };
}

function rodarMigracoes(caminhoBanco) {
    return spawnSync(process.execPath, [path.join(pastaUtils, "migrate_all.js")], {
        cwd: raiz,
        encoding: "utf8",
        env: {
            ...process.env,
            DATABASE_PATH: caminhoBanco,
            BACKUP: "0", // não encher a pasta temporária de cópias
        },
    });
}

test("migrate_all é repetível: a segunda passada não muda nada", () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "zap-migra-"));
    const banco = path.join(pasta, "sqlite.db");

    try {
        bancoDoZero(banco);

        const primeira = rodarMigracoes(banco);
        assert.equal(
            primeira.status,
            0,
            `primeira passada falhou:\n${primeira.stdout}\n${primeira.stderr}`
        );
        const depoisDa1 = retrato(banco);

        const segunda = rodarMigracoes(banco);
        assert.equal(
            segunda.status,
            0,
            `segunda passada falhou:\n${segunda.stdout}\n${segunda.stderr}`
        );
        const depoisDa2 = retrato(banco);

        assert.deepEqual(depoisDa2.objetos, depoisDa1.objetos, "o esquema mudou na segunda passada");
        assert.deepEqual(depoisDa2.contagens, depoisDa1.contagens, "o número de linhas mudou na segunda passada");

        // E o efeito principal aconteceu mesmo: o telefone deixou de ser obrigatório.
        const users = depoisDa1.objetos.find((o) => o.type === "table" && o.name === "users");
        assert.ok(users, "tabela users sumiu");
        assert.ok(
            !/`?phone`?\s+text\s+NOT\s+NULL/i.test(users.sql),
            "make_phone_nullable não tirou o NOT NULL do telefone"
        );
    } finally {
        fs.rmSync(pasta, { recursive: true, force: true });
    }
});

test("migrate_all sai com erro claro quando um script da lista falha", () => {
    // Banco apontado pra uma pasta que não existe: o primeiro script já quebra.
    const r = spawnSync(process.execPath, [path.join(pastaUtils, "migrate_all.js")], {
        cwd: raiz,
        encoding: "utf8",
        env: { ...process.env, DATABASE_PATH: path.join(os.tmpdir(), "pasta-que-nao-existe-zap", "x.db") },
    });

    assert.notEqual(r.status, 0, "deveria sair com código != 0");
    assert.match(r.stderr, /FALHOU/, "a mensagem precisa dizer qual script falhou");
});

// --- poda dos registros ----------------------------------------------------

test("prune_app_logs apaga só o que passou de 90 dias, e é repetível", () => {
    const Database = require_("better-sqlite3");
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "zap-poda-"));
    const banco = path.join(pasta, "sqlite.db");

    try {
        const db = new Database(banco);
        db.exec(`CREATE TABLE app_logs (
            id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
            level text DEFAULT 'info' NOT NULL,
            event text NOT NULL,
            created_at text DEFAULT CURRENT_TIMESTAMP
        )`);
        const ins = db.prepare("INSERT INTO app_logs (event, created_at) VALUES (?, ?)");
        ins.run("velho_formato_sqlite", "2020-01-01 10:00:00");
        ins.run("velho_formato_iso", "2020-01-01T10:00:00.000Z");
        ins.run("recente_formato_sqlite", new Date().toISOString().slice(0, 19).replace("T", " "));
        ins.run("recente_formato_iso", new Date().toISOString());
        db.close();

        const primeira = spawnSync(process.execPath, [path.join(pastaUtils, "prune_app_logs.js")], {
            cwd: raiz,
            encoding: "utf8",
            env: { ...process.env, DATABASE_PATH: banco },
        });
        assert.equal(primeira.status, 0, primeira.stderr);

        const leitura = new Database(banco, { readonly: true });
        const sobraram = leitura.prepare("SELECT event FROM app_logs ORDER BY id").all().map((r) => r.event);
        leitura.close();
        assert.deepEqual(sobraram, ["recente_formato_sqlite", "recente_formato_iso"]);

        const segunda = spawnSync(process.execPath, [path.join(pastaUtils, "prune_app_logs.js")], {
            cwd: raiz,
            encoding: "utf8",
            env: { ...process.env, DATABASE_PATH: banco },
        });
        assert.equal(segunda.status, 0, segunda.stderr);
        assert.match(segunda.stdout, /nada a podar/);
    } finally {
        fs.rmSync(pasta, { recursive: true, force: true });
    }
});
