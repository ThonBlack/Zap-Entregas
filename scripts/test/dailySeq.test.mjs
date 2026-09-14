/**
 * O contador diário das corridas — "Corrida 1, 2, 3…" por loja, recomeçando do
 * 1 a cada dia de Brasília.
 *
 * O que está sendo protegido:
 *
 *  (a) O backfill da migração numera o histórico por LOJA e por DIA, na ordem em
 *      que as corridas foram criadas — e rodar de novo não renumera nada. Se
 *      renumerasse, a corrida que a loja anunciou no grupo como "Corrida 7"
 *      viraria outra coisa no dia seguinte a um restart do container.
 *
 *  (b) `proximoNumeroDoDia` respeita o FUSO. A corrida das 23h30 de Brasília é
 *      gravada como 02h30 UTC do dia SEGUINTE; se a conta fosse feita em UTC, o
 *      contador virava no meio da noite de trabalho e a loja via "Corrida 1"
 *      duas vezes no mesmo expediente.
 *
 *  (c) O rótulo escreve sempre igual ("Corrida 7"), num lugar só — card,
 *      histórico, resumo do dia, push, rastreio e extrato leem daqui.
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/dailySeq.test.mjs
 *
 * Bancos DESCARTÁVEIS: nada aqui encosta no banco de desenvolvimento nem no de
 * produção.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { execFileSync, spawnSync } from "node:child_process";

const RAIZ = path.resolve(fileURLToPath(import.meta.url), "../../..");
const UTILS = path.join(RAIZ, "scripts", "utils");
const BANCO = path.join(os.tmpdir(), `zap-daily-seq-${process.pid}.db`);

const LOJA_A = 2;
const LOJA_B = 20;

// --- monta o banco de teste ANTES de importar o código (o @/db lê a env no load)
fs.copyFileSync(path.join(RAIZ, "sqlite.db"), BANCO);
process.env.DATABASE_PATH = BANCO;

// O sqlite.db local pode estar atrás do código: roda as migrações leves na
// cópia (as mesmas do start do container).
const migracoes = fs
    .readdirSync(UTILS)
    .filter((f) => /^add_.*\.js$/.test(f) || f === "make_phone_nullable.js")
    .sort();
for (const m of migracoes) {
    execFileSync(process.execPath, [path.join(UTILS, m)], {
        env: { ...process.env, DATABASE_PATH: BANCO },
        stdio: "ignore",
    });
}

const raw = new Database(BANCO);
raw.pragma("foreign_keys = OFF");
raw.exec("DELETE FROM daily_closings; DELETE FROM transactions; DELETE FROM deliveries;");

const inserir = raw.prepare(`
    INSERT INTO deliveries (id, shopkeeper_id, status, address, value, daily_seq, created_at, updated_at)
    VALUES (@id, @loja, @status, @endereco, 0, @numero, @criadaEm, @criadaEm)
`);
function corrida(o) {
    inserir.run({
        loja: LOJA_A, status: "pending", endereco: "Rua Teste, 100 - Centro",
        numero: null, ...o,
    });
}

const { db } = await import("@/db");
const { proximoNumeroDoDia, sequenciaDoDia } = await import("@/lib/dailySeq");
const {
    rotuloCorrida,
    rotuloCorridaComDia,
    nomeDaCorridaNoExtrato,
    faixaDeCorridas,
    temNumeroDoDia,
} = await import("@/lib/dailySeq-shared");

/** Roda a função do jeito que o app roda: dentro de uma transação. */
const proximo = (loja, agora) => db.transaction((tx) => proximoNumeroDoDia(tx, loja, agora));

test.after(() => {
    try { raw.close(); } catch { /* já fechado */ }
    try { fs.unlinkSync(BANCO); } catch { /* o Windows às vezes segura o arquivo */ }
});

// =========================================================================
// (c) o rótulo — parte pura, sem banco
// =========================================================================

test("o rótulo é sempre 'Corrida N'", () => {
    assert.equal(rotuloCorrida(1), "Corrida 1");
    assert.equal(rotuloCorrida(7), "Corrida 7");
    assert.equal(rotuloCorrida(135), "Corrida 135");
});

test("corrida sem número não ganha rótulo nenhum (e nada quebra)", () => {
    assert.equal(rotuloCorrida(null), null);
    assert.equal(rotuloCorrida(undefined), null);
    assert.equal(rotuloCorrida(0), null, "0 não é corrida nenhuma");
    assert.equal(temNumeroDoDia(null), false);
    assert.equal(temNumeroDoDia(7), true);
});

test("no extrato o rótulo leva o dia junto — e cai no #id quando não tem número", () => {
    // 14/09 às 09h de Brasília (12h UTC).
    assert.equal(
        rotuloCorridaComDia(7, "2026-09-14T12:00:00.000Z"),
        "Corrida 7 do dia 14/09",
    );
    // 23h30 de Brasília do dia 14 = 02h30 UTC do dia 15: o dia que vale é o 14.
    assert.equal(
        rotuloCorridaComDia(7, "2026-09-15T02:30:00.000Z"),
        "Corrida 7 do dia 14/09",
    );
    // Formato antigo do banco (CURRENT_TIMESTAMP, sem o "Z") vale também.
    assert.equal(
        rotuloCorridaComDia(3, "2026-09-14 12:00:00"),
        "Corrida 3 do dia 14/09",
    );

    assert.equal(nomeDaCorridaNoExtrato(135, 7, "2026-09-14T12:00:00.000Z"), "Corrida 7 do dia 14/09");
    assert.equal(nomeDaCorridaNoExtrato(135, null, "2026-09-14T12:00:00.000Z"), "Corrida #135");
    assert.equal(rotuloCorridaComDia(7, null), "Corrida 7", "sem data legível, sobra o número");
});

test("rota com várias paradas vira uma faixa de números", () => {
    assert.equal(faixaDeCorridas(7, 9), "Corridas 7 a 9");
    assert.equal(faixaDeCorridas(7, 7), "Corrida 7");
    assert.equal(faixaDeCorridas(null, 9), null);
});

// =========================================================================
// (b) o próximo número do dia
// =========================================================================

test("dia novo começa no 1", () => {
    assert.equal(proximo(LOJA_A, "2026-09-10T13:00:00.000Z"), 1);
});

test("no mesmo dia o número vai de um em um", () => {
    corrida({ id: 801, loja: LOJA_A, numero: 1, criadaEm: "2026-09-11T13:00:00.000Z" });
    assert.equal(proximo(LOJA_A, "2026-09-11T14:00:00.000Z"), 2);

    corrida({ id: 802, loja: LOJA_A, numero: 2, criadaEm: "2026-09-11T14:00:00.000Z" });
    assert.equal(proximo(LOJA_A, "2026-09-11T15:00:00.000Z"), 3);
});

test("o contador zera no dia seguinte", () => {
    assert.equal(proximo(LOJA_A, "2026-09-12T13:00:00.000Z"), 1);
});

test("cada loja tem a contagem dela", () => {
    // A loja B não viu nada do movimento da loja A.
    assert.equal(proximo(LOJA_B, "2026-09-11T15:00:00.000Z"), 1);
});

test("o dia é o de BRASÍLIA: 23h30 ainda é o dia que está acabando", () => {
    // 23h30 de 13/09 em Brasília = 02h30 UTC de 14/09.
    corrida({ id: 810, loja: LOJA_A, numero: 1, criadaEm: "2026-09-14T02:30:00.000Z" });

    // Meia hora depois (23h59 de Brasília, ainda dia 13): continua a mesma noite.
    assert.equal(
        proximo(LOJA_A, "2026-09-14T02:59:00.000Z"),
        2,
        "em UTC já era 14/09 e o contador teria voltado pro 1 no meio do expediente",
    );

    // Passada a meia-noite de Brasília (03h00 UTC), aí sim recomeça.
    assert.equal(proximo(LOJA_A, "2026-09-14T03:30:00.000Z"), 1);
});

test("rascunho não conta: ele só entra na fila quando é liberado", () => {
    corrida({ id: 820, loja: LOJA_B, status: "draft", criadaEm: "2026-09-13T13:00:00.000Z" });
    assert.equal(proximo(LOJA_B, "2026-09-13T14:00:00.000Z"), 1, "rascunho não tem número");
});

test("corrida cancelada mantém o número (o buraco confundiria mais que ajudaria)", () => {
    corrida({ id: 821, loja: LOJA_B, status: "canceled", numero: 1, criadaEm: "2026-09-16T13:00:00.000Z" });
    assert.equal(proximo(LOJA_B, "2026-09-16T14:00:00.000Z"), 2);
});

test("corrida sem loja não é numerada (e não estoura)", () => {
    assert.equal(proximo(null, "2026-09-11T15:00:00.000Z"), null);
    assert.equal(proximo(LOJA_A, "data-que-não-existe"), null);
});

test("a rota pede os números seguidos de uma vez", () => {
    const numeros = db.transaction((tx) => sequenciaDoDia(tx, LOJA_A, "2026-09-17T13:00:00.000Z", 3));
    assert.deepEqual(numeros, [1, 2, 3]);

    const semLoja = db.transaction((tx) => sequenciaDoDia(tx, null, "2026-09-17T13:00:00.000Z", 2));
    assert.deepEqual(semLoja, [null, null]);
});

// =========================================================================
// (a) a migração e o backfill
// =========================================================================

/** Banco descartável com o esquema mais antigo do projeto + todas as migrações. */
function bancoMigradoDoZero(destino) {
    const sqlBase = fs.readFileSync(path.join(RAIZ, "drizzle", "0000_huge_nebula.sql"), "utf8");
    const novo = new Database(destino);
    novo.pragma("foreign_keys = OFF");
    novo.exec(sqlBase.split("--> statement-breakpoint").join(";"));
    novo.close();

    const r = spawnSync(process.execPath, [path.join(UTILS, "migrate_all.js")], {
        cwd: RAIZ,
        encoding: "utf8",
        env: { ...process.env, DATABASE_PATH: destino },
    });
    assert.equal(r.status, 0, `migrate_all falhou:\n${r.stdout}\n${r.stderr}`);
}

function rodarBackfill(caminho) {
    const r = spawnSync(process.execPath, [path.join(UTILS, "add_daily_seq_column.js")], {
        cwd: RAIZ,
        encoding: "utf8",
        env: { ...process.env, DATABASE_PATH: caminho },
    });
    assert.equal(r.status, 0, `add_daily_seq_column falhou:\n${r.stdout}\n${r.stderr}`);
    return r.stdout;
}

test("o backfill numera por loja e por dia, na ordem em que as corridas nasceram", () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "zap-seq-"));
    const caminho = path.join(pasta, "sqlite.db");

    try {
        bancoMigradoDoZero(caminho);

        const antigo = new Database(caminho);
        antigo.pragma("foreign_keys = OFF");

        // A coluna e o índice existem depois da migração.
        const cols = new Set(antigo.prepare("PRAGMA table_info(deliveries)").all().map((c) => c.name));
        assert.ok(cols.has("daily_seq"), "a coluna daily_seq tinha que existir");
        const indices = antigo.prepare("PRAGMA index_list(deliveries)").all().map((i) => i.name);
        assert.ok(indices.includes("deliveries_shop_day_seq_idx"), "o índice do contador tinha que existir");

        const ins = antigo.prepare(`
            INSERT INTO deliveries (id, shopkeeper_id, status, address, created_at, updated_at)
            VALUES (?, ?, ?, 'Rua Teste, 100', ?, ?)
        `);
        // Inseridas FORA de ordem de propósito: quem manda é o created_at.
        //   Loja A, 12/09: três corridas
        ins.run(2, LOJA_A, "delivered", "2026-09-12T15:00:00.000Z", "2026-09-12T15:00:00.000Z");
        ins.run(1, LOJA_A, "delivered", "2026-09-12T13:00:00.000Z", "2026-09-12T13:00:00.000Z");
        ins.run(3, LOJA_A, "canceled", "2026-09-12T17:00:00.000Z", "2026-09-12T17:00:00.000Z");
        //   Loja A, 13/09: recomeça do 1
        ins.run(4, LOJA_A, "delivered", "2026-09-13T13:00:00.000Z", "2026-09-13T13:00:00.000Z");
        //   Loja B, 12/09: contagem própria
        ins.run(5, LOJA_B, "delivered", "2026-09-12T14:00:00.000Z", "2026-09-12T14:00:00.000Z");
        //   Rascunho: fica sem número
        ins.run(6, LOJA_A, "draft", "2026-09-12T16:00:00.000Z", "2026-09-12T16:00:00.000Z");
        //   Formato antigo do banco (CURRENT_TIMESTAMP, sem "Z") — mesma noite de 12/09
        ins.run(7, LOJA_A, "delivered", "2026-09-12 18:00:00", "2026-09-12 18:00:00");
        //   23h30 de Brasília de 13/09 = 02h30 UTC de 14/09: é a corrida 2 do dia 13
        ins.run(8, LOJA_A, "delivered", "2026-09-14T02:30:00.000Z", "2026-09-14T02:30:00.000Z");
        antigo.close();

        const saida = rodarBackfill(caminho);
        assert.match(saida, /numerada/, "a saída precisa dizer quantas foram numeradas");

        const leitura = new Database(caminho, { readonly: true });
        const porId = new Map(
            leitura.prepare("SELECT id, daily_seq FROM deliveries").all().map((r) => [r.id, r.daily_seq])
        );
        leitura.close();

        // Loja A, 12/09, na ordem do relógio: 13h → 14h(outra loja) → 15h → 17h → 18h
        assert.equal(porId.get(1), 1, "13h é a primeira do dia");
        assert.equal(porId.get(2), 2, "15h é a segunda");
        assert.equal(porId.get(3), 3, "cancelada continua ocupando o número dela");
        assert.equal(porId.get(7), 4, "data no formato antigo entra no mesmo dia");
        // Loja A, 13/09
        assert.equal(porId.get(4), 1, "dia novo começa do 1");
        assert.equal(porId.get(8), 2, "23h30 de Brasília ainda é o dia 13");
        // Loja B
        assert.equal(porId.get(5), 1, "cada loja tem a contagem dela");
        // Rascunho
        assert.equal(porId.get(6), null, "rascunho ainda não é corrida");
    } finally {
        fs.rmSync(pasta, { recursive: true, force: true });
    }
});

test("rodar o backfill de novo não renumera nada", () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "zap-seq2-"));
    const caminho = path.join(pasta, "sqlite.db");

    try {
        bancoMigradoDoZero(caminho);

        const antigo = new Database(caminho);
        antigo.pragma("foreign_keys = OFF");
        const ins = antigo.prepare(`
            INSERT INTO deliveries (id, shopkeeper_id, status, address, created_at, updated_at)
            VALUES (?, ?, 'delivered', 'Rua Teste, 100', ?, ?)
        `);
        ins.run(1, LOJA_A, "2026-09-12T13:00:00.000Z", "2026-09-12T13:00:00.000Z");
        ins.run(2, LOJA_A, "2026-09-12T15:00:00.000Z", "2026-09-12T15:00:00.000Z");
        antigo.close();

        rodarBackfill(caminho);
        const retrato = () => {
            const leitura = new Database(caminho, { readonly: true });
            const linhas = leitura.prepare("SELECT id, daily_seq FROM deliveries ORDER BY id").all();
            leitura.close();
            return linhas;
        };
        const depoisDa1 = retrato();

        const saida = rodarBackfill(caminho);
        assert.match(saida, /nada a numerar/, "a segunda passada não tem o que fazer");
        assert.deepEqual(retrato(), depoisDa1, "a segunda passada mexeu nos números");

        // E uma corrida NOVA, que entra depois, continua a contagem do dia —
        // não volta pro 1 nem repete número.
        const depois = new Database(caminho);
        depois.pragma("foreign_keys = OFF");
        depois.prepare(`
            INSERT INTO deliveries (id, shopkeeper_id, status, address, created_at, updated_at)
            VALUES (3, ?, 'pending', 'Rua Teste, 300', ?, ?)
        `).run(LOJA_A, "2026-09-12T18:00:00.000Z", "2026-09-12T18:00:00.000Z");
        depois.close();

        rodarBackfill(caminho);
        const final = new Map(retrato().map((r) => [r.id, r.daily_seq]));
        assert.deepEqual([final.get(1), final.get(2), final.get(3)], [1, 2, 3]);
    } finally {
        fs.rmSync(pasta, { recursive: true, force: true });
    }
});
