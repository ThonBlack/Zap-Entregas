/**
 * Testes do cálculo da taxa da corrida (src/lib/fee.ts) e do leitor de dinheiro
 * digitado (src/lib/money.ts).
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/fee.test.mjs
 *
 * Não encosta em banco nenhum: é conta pura.
 */
import test from "node:test";
import assert from "node:assert/strict";

const { calcularTaxa, modeloEfetivo, dependeDaDistancia, distanciaDaLoja } = await import("@/lib/fee");
const { parseMoney } = await import("@/lib/money");

const regra = (o) => ({
    remunerationModel: "fixed",
    fixedValue: 0,
    valuePerKm: 0,
    guaranteedMinimum: 0,
    ...o,
});

test("taxa fixa: paga o valor combinado, com ou sem distância", () => {
    const r = regra({ remunerationModel: "fixed", fixedValue: 7.5, valuePerKm: 2 });
    assert.equal(calcularTaxa(r, 10), 7.5, "km não entra na conta do modelo fixo");
    assert.equal(calcularTaxa(r, null), 7.5);
});

test("por km: valor por quilômetro vezes a distância", () => {
    const r = regra({ remunerationModel: "distance", valuePerKm: 2, fixedValue: 5 });
    assert.equal(calcularTaxa(r, 3), 6);
    assert.equal(calcularTaxa(r, 0), 0, "distância zero (mesma coordenada) paga zero");
    assert.equal(calcularTaxa(r, 4.25), 8.5);
});

test("por km sem coordenada cai na taxa fixa da loja", () => {
    const r = regra({ remunerationModel: "distance", valuePerKm: 2, fixedValue: 5 });
    assert.equal(calcularTaxa(r, null), 5, "sem pino não dá pra multiplicar");
});

test("híbrido: taxa de saída mais o que rodou", () => {
    const r = regra({ remunerationModel: "hybrid", fixedValue: 4, valuePerKm: 1.5 });
    assert.equal(calcularTaxa(r, 6), 13);
    assert.equal(calcularTaxa(r, null), 4, "sem distância sobra só a saída");
});

test("mínimo garantido é piso, não soma", () => {
    const porKm = regra({ remunerationModel: "distance", valuePerKm: 2, guaranteedMinimum: 8 });
    assert.equal(calcularTaxa(porKm, 1), 8, "1km daria 2, o piso levanta pra 8");
    assert.equal(calcularTaxa(porKm, 10), 20, "acima do piso o piso não mexe");

    const fixo = regra({ remunerationModel: "fixed", fixedValue: 5, guaranteedMinimum: 6 });
    assert.equal(calcularTaxa(fixo, null), 6);

    const semPiso = regra({ remunerationModel: "fixed", fixedValue: 5, guaranteedMinimum: 0 });
    assert.equal(calcularTaxa(semPiso, null), 5, "piso 0 é 'não usar'");
});

test("arredonda em centavos", () => {
    const r = regra({ remunerationModel: "distance", valuePerKm: 1.99 });
    assert.equal(calcularTaxa(r, 3.333), 6.63);
});

test('"Diária" foi aposentada e vale como taxa fixa', () => {
    assert.equal(modeloEfetivo("daily"), "fixed");
    assert.equal(modeloEfetivo("qualquer coisa"), "fixed");
    assert.equal(modeloEfetivo(null), "fixed");
    const r = regra({ remunerationModel: "daily", fixedValue: 9 });
    assert.equal(calcularTaxa(r, 20), 9);
});

test("loja sem regra salva não paga nada automático", () => {
    assert.equal(calcularTaxa(null, 5), 0);
    assert.equal(calcularTaxa(undefined, null), 0);
    assert.equal(calcularTaxa(regra({}), 5), 0, "fixo 0 e por km 0 = 0");
});

test("valor negativo salvo por engano não vira taxa negativa", () => {
    const r = regra({ remunerationModel: "fixed", fixedValue: -10 });
    assert.equal(calcularTaxa(r, null), 0);
});

test("o webhook do PDV sabe quais modelos precisam da distância", () => {
    assert.equal(dependeDaDistancia("distance"), true);
    assert.equal(dependeDaDistancia("hybrid"), true);
    assert.equal(dependeDaDistancia("fixed"), false);
    assert.equal(dependeDaDistancia("daily"), false);
});

test("distância só sai com as duas pontas no mapa", () => {
    assert.equal(distanciaDaLoja(null, null, -19.7, -47.9), null);
    assert.equal(distanciaDaLoja(-19.7, -47.9, 0, 0), null, "0,0 é 'sem pino', não o Atlântico");
    const km = distanciaDaLoja(-19.7472, -47.9381, -19.7572, -47.9381);
    assert.ok(km > 1 && km < 1.3, `~1,1km esperado, veio ${km}`);
});

// ── dinheiro digitado ───────────────────────────────────────────────────────

test('"1.850,00" é mil oitocentos e cinquenta, não R$ 1,85', () => {
    assert.equal(parseMoney("1.850,00"), 1850);
    assert.equal(parseMoney("R$ 1.234,56"), 1234.56);
});

test('"12,50" vira 12.5', () => {
    assert.equal(parseMoney("12,50"), 12.5);
    assert.equal(parseMoney("12.50"), 12.5);
    assert.equal(parseMoney(" 7 "), 7);
});

test('"abc" e vazio devolvem null (pra virar erro na tela, nunca zero)', () => {
    assert.equal(parseMoney("abc"), null);
    assert.equal(parseMoney(""), null);
    assert.equal(parseMoney("  "), null);
    assert.equal(parseMoney("12,,50"), null);
    assert.equal(parseMoney(null), null);
    assert.equal(parseMoney(undefined), null);
});
