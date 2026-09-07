/**
 * P0 da auditoria de negócio: "Recebi outro valor" com o campo em branco
 * gravava R$ 0,00 e não criava o débito do dinheiro que ficou com o motoboy.
 *
 * Rodar:
 *   node --import ./scripts/test/register.mjs --test scripts/test/receipt.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { validarRecebimento, AVISO_VALOR_VAZIO } = await import("@/lib/receipt");

test("valor_diferente sem valor nenhum é recusado", () => {
    const r = validarRecebimento({ status: "valor_diferente", method: "dinheiro" });
    assert.equal(r.error, AVISO_VALOR_VAZIO);
});

test("valor_diferente com zero é recusado", () => {
    const r = validarRecebimento({ status: "valor_diferente", amount: 0, method: "dinheiro" });
    assert.equal(r.error, AVISO_VALOR_VAZIO);
});

test('valor_diferente com string vazia (o Number("") do bug) é recusado', () => {
    const r = validarRecebimento({ status: "valor_diferente", amount: "", method: "dinheiro" });
    assert.equal(r.error, AVISO_VALOR_VAZIO);
});

test("valor_diferente com 12,50 passa e vira 12.5", () => {
    const r = validarRecebimento({ status: "valor_diferente", amount: "12,50", method: "dinheiro" });
    assert.equal(r.error, undefined);
    assert.equal(r.amount, 12.5);
    assert.equal(r.method, "dinheiro");
    assert.equal(r.status, "valor_diferente");
});

test("valor com milhar no formato brasileiro (1.234,56)", () => {
    const r = validarRecebimento({ status: "valor_diferente", amount: "1.234,56", method: "pix" });
    assert.equal(r.amount, 1234.56);
});

test("valor_diferente sem forma de pagamento é recusado", () => {
    const r = validarRecebimento({ status: "valor_diferente", amount: "10" });
    assert.match(r.error, /Informe como recebeu/);
});

test("não recebi passa com zero e sem forma de pagamento", () => {
    const r = validarRecebimento({ status: "nao_recebido" });
    assert.equal(r.error, undefined);
    assert.equal(r.amount, 0);
    assert.equal(r.method, null);
});

test("nada a receber passa com zero", () => {
    const r = validarRecebimento({ status: "nada_a_receber" });
    assert.equal(r.amount, 0);
});

test('"recebi o valor" com zero continua aceito (pedido já pago vale 0)', () => {
    const r = validarRecebimento({ status: "recebido", amount: 0, method: "cartao" });
    assert.equal(r.error, undefined);
    assert.equal(r.amount, 0);
});

test("valor absurdo é recusado", () => {
    const r = validarRecebimento({ status: "valor_diferente", amount: 999999, method: "dinheiro" });
    assert.match(r.error, /inválido/);
});

test("status inventado é recusado", () => {
    const r = validarRecebimento({ status: "seila" });
    assert.match(r.error, /inválido/);
});

test("observação é aparada e limitada a 500", () => {
    const r = validarRecebimento({
        status: "nao_recebido",
        note: "  " + "a".repeat(600) + "  ",
    });
    assert.equal(r.note.length, 500);
});
