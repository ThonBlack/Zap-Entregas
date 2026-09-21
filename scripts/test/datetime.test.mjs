/**
 * Testes dos ajudantes de data usados pelo fechamento do dia.
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/datetime.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
    ehDiaISO,
    somaDiasISO,
    diaBrasiliaDe,
    fmtDiaCurto,
    inicioDaSemanaISO,
    fimDaSemanaISO,
    rotuloDaSemana,
} = await import("@/lib/datetime");

test("ehDiaISO só aceita dia que existe de verdade", () => {
    assert.equal(ehDiaISO("2026-09-07"), true);
    assert.equal(ehDiaISO("2026-02-30"), false, "30 de fevereiro não existe");
    assert.equal(ehDiaISO("2026-9-7"), false, "precisa de dois dígitos");
    assert.equal(ehDiaISO("ontem"), false);
    assert.equal(ehDiaISO(undefined), false);
    assert.equal(ehDiaISO("2026-09-07T10:00:00Z"), false);
});

test("somaDiasISO atravessa virada de mês e de ano", () => {
    assert.equal(somaDiasISO("2026-09-07", -1), "2026-09-06");
    assert.equal(somaDiasISO("2026-09-30", 1), "2026-10-01");
    assert.equal(somaDiasISO("2026-01-01", -1), "2025-12-31");
    assert.equal(somaDiasISO("2028-02-28", 1), "2028-02-29", "2028 é bissexto");
});

test("diaBrasiliaDe joga a hora UTC pro dia certo", () => {
    // 02:30 em Londres ainda é 23:30 do dia anterior em Brasília
    assert.equal(diaBrasiliaDe("2026-09-04T02:30:00.000Z"), "2026-09-03");
    assert.equal(diaBrasiliaDe("2026-09-04T03:30:00.000Z"), "2026-09-04");
    // formato antigo do CURRENT_TIMESTAMP (UTC sem dizer que é UTC)
    assert.equal(diaBrasiliaDe("2026-09-05 20:00:00"), "2026-09-05");
    assert.equal(diaBrasiliaDe("2026-09-05 01:00:00"), "2026-09-04");
    assert.equal(diaBrasiliaDe(null), null);
});

test("fmtDiaCurto mostra dia/mês", () => {
    assert.equal(fmtDiaCurto("2026-09-07"), "07/09");
});

test("a semana do controle vai de segunda a domingo", () => {
    // 14/09/2026 é segunda; 20/09 é o domingo que fecha essa semana.
    for (const dia of ["2026-09-14", "2026-09-15", "2026-09-17", "2026-09-20"]) {
        assert.equal(inicioDaSemanaISO(dia), "2026-09-14", `${dia} é da semana de 14/09`);
        assert.equal(fimDaSemanaISO(dia), "2026-09-20");
    }
    // O domingo pertence à semana que COMEÇOU na segunda anterior, não à seguinte.
    assert.equal(inicioDaSemanaISO("2026-09-21"), "2026-09-21", "21/09 é a segunda seguinte");
});

test("a semana atravessa virada de mês e de ano", () => {
    // 01/10/2026 é quinta: a semana dela começou em 28/09.
    assert.equal(inicioDaSemanaISO("2026-10-01"), "2026-09-28");
    assert.equal(fimDaSemanaISO("2026-09-28"), "2026-10-04");
    // 01/01/2027 é sexta: a semana dela começou em 28/12/2026.
    assert.equal(inicioDaSemanaISO("2027-01-01"), "2026-12-28");
    assert.equal(fimDaSemanaISO("2027-01-01"), "2027-01-03");
});

test("o rótulo da semana é o que a loja lê na tela", () => {
    assert.equal(rotuloDaSemana("2026-09-17"), "14/09 a 20/09");
    assert.equal(rotuloDaSemana("2026-10-01"), "28/09 a 04/10");
});

test("dia ilegível não vira semana inventada", () => {
    for (const lixo of ["ontem", "2026-02-30", ""]) {
        assert.equal(inicioDaSemanaISO(lixo), lixo);
        assert.equal(fimDaSemanaISO(lixo), lixo);
        assert.equal(rotuloDaSemana(lixo), lixo);
    }
});
