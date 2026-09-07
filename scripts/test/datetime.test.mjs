/**
 * Testes dos ajudantes de data usados pelo fechamento do dia.
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/datetime.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { ehDiaISO, somaDiasISO, diaBrasiliaDe, fmtDiaCurto } = await import("@/lib/datetime");

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
