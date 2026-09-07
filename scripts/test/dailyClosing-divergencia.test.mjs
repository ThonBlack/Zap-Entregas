/**
 * Testes de `fechamentoDivergente` (src/lib/dailyClosing-shared.ts).
 *
 * Função pura, sem banco — compara os totais CONGELADOS de um fechamento já
 * enviado/confirmado com o resumo VIVO recalculado na hora, e diz quais
 * campos mudaram. É o que acende o aviso "os números mudaram" na tela da
 * loja e a linha discreta no card do motoboy.
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/dailyClosing-divergencia.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { fechamentoDivergente } = await import("@/lib/dailyClosing-shared");

function totais(o) {
    return {
        deliveriesCount: 4,
        feesTotal: 39.5,
        cashTotal: 150,
        pixTotal: 80,
        cardTotal: 60,
        net: -110.5,
        ...o,
    };
}

test("totais iguais não divergem", () => {
    const congelado = totais({});
    const vivo = totais({});
    const r = fechamentoDivergente(congelado, vivo);
    assert.equal(r.divergente, false);
    assert.deepEqual(r.campos, []);
});

test("diferença de 1 corrida diverge", () => {
    const r = fechamentoDivergente(totais({}), totais({ deliveriesCount: 5 }));
    assert.equal(r.divergente, true);
    assert.deepEqual(r.campos, ["deliveriesCount"]);
});

test("diferença na taxa diverge", () => {
    const r = fechamentoDivergente(totais({}), totais({ feesTotal: 45 }));
    assert.equal(r.divergente, true);
    assert.deepEqual(r.campos, ["feesTotal"]);
});

test("diferença no dinheiro diverge", () => {
    const r = fechamentoDivergente(totais({}), totais({ cashTotal: 200 }));
    assert.equal(r.divergente, true);
    assert.deepEqual(r.campos, ["cashTotal"]);
});

test("diferença no PIX diverge", () => {
    const r = fechamentoDivergente(totais({}), totais({ pixTotal: 90 }));
    assert.equal(r.divergente, true);
    assert.deepEqual(r.campos, ["pixTotal"]);
});

test("diferença no cartão diverge", () => {
    const r = fechamentoDivergente(totais({}), totais({ cardTotal: 70 }));
    assert.equal(r.divergente, true);
    assert.deepEqual(r.campos, ["cardTotal"]);
});

test("diferença no líquido diverge", () => {
    const r = fechamentoDivergente(totais({}), totais({ net: -100 }));
    assert.equal(r.divergente, true);
    assert.deepEqual(r.campos, ["net"]);
});

test("mais de um campo mudando lista todos", () => {
    const r = fechamentoDivergente(totais({}), totais({ deliveriesCount: 5, feesTotal: 45 }));
    assert.equal(r.divergente, true);
    assert.deepEqual(r.campos, ["deliveriesCount", "feesTotal"]);
});

test("tolerância de meio centavo não acusa divergência (lixo de ponto flutuante)", () => {
    const r = fechamentoDivergente(totais({}), totais({ feesTotal: 39.5 + 0.001, cashTotal: 150 - 0.004 }));
    assert.equal(r.divergente, false);
    assert.deepEqual(r.campos, []);
});

test("um centavo inteiro de diferença já conta", () => {
    const r = fechamentoDivergente(totais({}), totais({ feesTotal: 39.51 }));
    assert.equal(r.divergente, true);
    assert.deepEqual(r.campos, ["feesTotal"]);
});
