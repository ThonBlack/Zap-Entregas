/**
 * Testes do lançamento manual na carteira (src/lib/lancamentoManual.ts).
 *
 * O que está sendo protegido:
 *
 *  (a) O campo "Data". A devolução de sábado, lançada na segunda, tem que
 *      contar no SÁBADO — senão o controle de "em que dia ele devolveu" mente.
 *      Futuro e data velha demais não podem entrar de jeito nenhum.
 *
 *  (b) A trava de cópia. Apertar "voltar" no navegador reabria o formulário
 *      preenchido e salvava o mesmo pagamento duas vezes. A trava tinha que
 *      continuar funcionando depois de ganhar o campo de data — inclusive pro
 *      lançamento atrasado, cujo carimbo não é mais "agora".
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/lancamentoManual.test.mjs
 *
 * Usa um banco DESCARTÁVEL (cópia do sqlite.db local numa pasta temporária).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const RAIZ = path.resolve(fileURLToPath(import.meta.url), "../../..");
const BANCO = path.join(os.tmpdir(), `zap-lancamento-manual-${process.pid}.db`);

const LOJA = 2;
const MOTOBOY = 3;

fs.copyFileSync(path.join(RAIZ, "sqlite.db"), BANCO);
process.env.DATABASE_PATH = BANCO;

// O sqlite.db local pode estar atrás do código: roda as migrações leves na
// cópia (as mesmas do CMD do Dockerfile).
const { execFileSync } = await import("node:child_process");
const migracoes = fs
    .readdirSync(path.join(RAIZ, "scripts", "utils"))
    .filter((f) => /^add_.*\.js$/.test(f) || f === "make_phone_nullable.js")
    .sort();
for (const m of migracoes) {
    execFileSync(process.execPath, [path.join(RAIZ, "scripts", "utils", m)], {
        env: { ...process.env, DATABASE_PATH: BANCO },
        stdio: "ignore",
    });
}

const raw = new Database(BANCO);
raw.pragma("foreign_keys = OFF");
raw.exec("DELETE FROM daily_closings; DELETE FROM transactions; DELETE FROM deliveries;");
raw.close();

const {
    registrarLancamentoManual,
    AVISO_CAMPOS,
    AVISO_VALOR,
    AVISO_REPETIDO,
} = await import("@/lib/lancamentoManual");
const { AVISO_DATA_FUTURA, AVISO_DATA_ANTIGA, AVISO_DATA_ILEGIVEL } =
    await import("@/lib/lancamentoRetroativo");
const { diaBrasiliaDe } = await import("@/lib/datetime");
const { getLedgerPorDia } = await import("@/lib/ledgerDiario");

/** Quinta, 17/09/2026, 14h30 de Brasília (17h30 UTC). */
const QUINTA_1430 = new Date("2026-09-17T17:30:00.000Z");
/** 00h30 de Brasília de sexta 18/09 — em UTC já são 03h30 do mesmo dia. */
const SEXTA_0030 = new Date("2026-09-18T03:30:00.000Z");
/** 23h30 de Brasília de quinta 17/09 — em UTC já é sexta. */
const QUINTA_2330 = new Date("2026-09-18T02:30:00.000Z");

const base = {
    motoboyId: MOTOBOY,
    creatorId: LOJA,
    entryKey: "recebi",
    valorDigitado: "140,00",
};

function limpar() {
    const db = new Database(BANCO);
    db.exec("DELETE FROM transactions");
    db.close();
}

function lidoDoBanco(id) {
    const db = new Database(BANCO, { readonly: true });
    const linha = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id);
    db.close();
    return linha;
}

test.after(() => {
    try { fs.unlinkSync(BANCO); } catch { /* o Windows às vezes segura o arquivo; não é problema */ }
});

// =========================================================================
// Sem data: o comportamento de sempre
// =========================================================================

test("sem data escolhida, o lançamento nasce agora — como sempre foi", async () => {
    limpar();
    const r = await registrarLancamentoManual({ ...base, agora: QUINTA_1430 });
    assert.equal(r.ok, true);
    assert.equal(r.retroativo, false);
    assert.equal(r.dia, "2026-09-17");

    const linha = lidoDoBanco(r.id);
    assert.equal(linha.created_at, QUINTA_1430.toISOString());
    assert.equal(linha.amount, 140);
    assert.equal(linha.type, "credit");
    assert.equal(linha.kind, "pagamento");
    assert.equal(linha.status, "confirmed");
    assert.equal(linha.description, "Motoboy me entregou dinheiro", "sem descrição, entra o rótulo da opção");
});

test("'pedir confirmação do motoboy' continua nascendo pendente", async () => {
    limpar();
    const r = await registrarLancamentoManual({ ...base, precisaConfirmar: true, agora: QUINTA_1430 });
    assert.equal(lidoDoBanco(r.id).status, "pending");
});

// =========================================================================
// (a) o campo "Data"
// =========================================================================

test("a devolução de sábado, lançada na quinta, conta no SÁBADO", async () => {
    limpar();
    const r = await registrarLancamentoManual({
        ...base, dataDigitada: "2026-09-12", agora: QUINTA_1430,
    });
    assert.equal(r.ok, true);
    assert.equal(r.retroativo, true);
    assert.equal(r.dia, "2026-09-12");
    assert.equal(diaBrasiliaDe(lidoDoBanco(r.id).created_at), "2026-09-12");

    // E é nesse dia que o controle vai mostrar a devolução.
    const ledger = await getLedgerPorDia(MOTOBOY, "2026-09-12", "2026-09-17");
    assert.deepEqual(ledger.dias.map((d) => d.dia), ["2026-09-12"]);
    assert.equal(ledger.dias[0].devolveu, 140);
});

test("hoje escrito à mão é igual a não escrever nada", async () => {
    limpar();
    const r = await registrarLancamentoManual({
        ...base, dataDigitada: "2026-09-17", agora: QUINTA_1430,
    });
    assert.equal(r.retroativo, false);
    assert.equal(lidoDoBanco(r.id).created_at, QUINTA_1430.toISOString());
});

test("lançar de madrugada não empurra a devolução pro dia errado", async () => {
    limpar();
    // 00h30 de sexta em Brasília: em UTC ainda é 18/09, mas a devolução é de
    // quinta e tem que ficar em quinta.
    const r = await registrarLancamentoManual({
        ...base, dataDigitada: "2026-09-17", agora: SEXTA_0030,
    });
    assert.equal(diaBrasiliaDe(lidoDoBanco(r.id).created_at), "2026-09-17");

    limpar();
    // O contrário: 23h30 de quinta em Brasília (já 18/09 em UTC) sem escolher
    // data nenhuma continua sendo quinta.
    const hoje = await registrarLancamentoManual({ ...base, agora: QUINTA_2330 });
    assert.equal(hoje.dia, "2026-09-17");
    assert.equal(diaBrasiliaDe(lidoDoBanco(hoje.id).created_at), "2026-09-17");
});

test("data no futuro é recusada e nada é gravado", async () => {
    limpar();
    const r = await registrarLancamentoManual({
        ...base, dataDigitada: "2026-09-18", agora: QUINTA_1430,
    });
    assert.deepEqual(r, { ok: false, erro: AVISO_DATA_FUTURA });
    const ledger = await getLedgerPorDia(MOTOBOY, "2026-01-01", "2026-12-31");
    assert.deepEqual(ledger.dias, [], "nada entrou na carteira");
});

test("data velha demais (mais de 60 dias) é recusada", async () => {
    limpar();
    const noLimite = await registrarLancamentoManual({
        ...base, dataDigitada: "2026-07-19", agora: QUINTA_1430,
    });
    assert.equal(noLimite.ok, true, "o último dia da janela ainda vale");

    const velha = await registrarLancamentoManual({
        ...base, dataDigitada: "2026-07-18", agora: QUINTA_1430,
    });
    assert.deepEqual(velha, { ok: false, erro: AVISO_DATA_ANTIGA });
});

test("data ilegível é erro na tela, nunca uma data inventada", async () => {
    limpar();
    for (const lixo of ["ontem", "12/09/2026", "2026-9-12", "2026-02-30"]) {
        const r = await registrarLancamentoManual({ ...base, dataDigitada: lixo, agora: QUINTA_1430 });
        assert.deepEqual(r, { ok: false, erro: AVISO_DATA_ILEGIVEL }, `"${lixo}" não podia passar`);
    }
});

// =========================================================================
// Valor e campos obrigatórios
// =========================================================================

test("valor ilegível ou zerado não vira lançamento", async () => {
    limpar();
    for (const ruim of ["", "0", "-50", "abc", "R$"]) {
        const r = await registrarLancamentoManual({ ...base, valorDigitado: ruim, agora: QUINTA_1430 });
        assert.equal(r.ok, false, `"${ruim}" não podia passar`);
        assert.equal(r.erro === AVISO_VALOR || r.erro === AVISO_CAMPOS, true);
    }
});

test("'1.850,00' é mil oitocentos e cinquenta, não um e oitenta e cinco", async () => {
    limpar();
    const r = await registrarLancamentoManual({ ...base, valorDigitado: "1.850,00", agora: QUINTA_1430 });
    assert.equal(lidoDoBanco(r.id).amount, 1850);
});

test("tipo de lançamento que não existe é recusado", async () => {
    limpar();
    const r = await registrarLancamentoManual({ ...base, entryKey: "sei_la", agora: QUINTA_1430 });
    assert.deepEqual(r, { ok: false, erro: AVISO_CAMPOS });
});

// =========================================================================
// (b) a trava de cópia
// =========================================================================

test("o mesmo lançamento salvo de novo em segundos é recusado", async () => {
    limpar();
    const primeiro = await registrarLancamentoManual({ ...base, agora: QUINTA_1430 });
    assert.equal(primeiro.ok, true);

    const denovo = await registrarLancamentoManual({
        ...base, agora: new Date(QUINTA_1430.getTime() + 20_000),
    });
    assert.deepEqual(denovo, { ok: false, erro: AVISO_REPETIDO });
});

test("a trava vale também pro lançamento com data escolhida", async () => {
    limpar();
    const primeiro = await registrarLancamentoManual({
        ...base, dataDigitada: "2026-09-12", agora: QUINTA_1430,
    });
    assert.equal(primeiro.ok, true);

    // Dois envios seguidos: o carimbo dos dois cai no dia 12, com segundos de
    // diferença. Antes da janela ficar em volta do carimbo, isto passava.
    const denovo = await registrarLancamentoManual({
        ...base, dataDigitada: "2026-09-12", agora: new Date(QUINTA_1430.getTime() + 15_000),
    });
    assert.deepEqual(denovo, { ok: false, erro: AVISO_REPETIDO });
});

test("passado mais de um minuto, o mesmo valor entra de novo (acerto repetido é normal)", async () => {
    limpar();
    await registrarLancamentoManual({ ...base, agora: QUINTA_1430 });
    const depois = await registrarLancamentoManual({
        ...base, agora: new Date(QUINTA_1430.getTime() + 61_000),
    });
    assert.equal(depois.ok, true);
});

test("mesmo valor em DIAS diferentes não é cópia", async () => {
    limpar();
    await registrarLancamentoManual({ ...base, dataDigitada: "2026-09-12", agora: QUINTA_1430 });
    const outroDia = await registrarLancamentoManual({
        ...base, dataDigitada: "2026-09-13", agora: QUINTA_1430,
    });
    assert.equal(outroDia.ok, true);

    const ledger = await getLedgerPorDia(MOTOBOY, "2026-09-12", "2026-09-13");
    assert.deepEqual(ledger.dias.map((d) => [d.dia, d.devolveu]), [
        ["2026-09-12", 140],
        ["2026-09-13", 140],
    ]);
});

test("valor ou tipo diferente não é cópia", async () => {
    limpar();
    await registrarLancamentoManual({ ...base, agora: QUINTA_1430 });
    const outroValor = await registrarLancamentoManual({
        ...base, valorDigitado: "141,00", agora: QUINTA_1430,
    });
    assert.equal(outroValor.ok, true);
    const outroTipo = await registrarLancamentoManual({
        ...base, entryKey: "paguei", agora: QUINTA_1430,
    });
    assert.equal(outroTipo.ok, true, "'paguei' é débito: não é o mesmo lançamento");
});
