/**
 * Tipo de cobrança da corrida (src/lib/chargeMode.ts) e o que ele muda na
 * conferência do recebimento (src/lib/receipt.ts).
 *
 * O que está sendo protegido aqui: a régua ANTIGA era `value > 0` = "o motoboy
 * cobra do cliente", e ela não sabia distinguir isso de "o cliente paga no PIX
 * DA LOJA e o motoboy só confere". Os dois casos mexem na carteira do motoboy
 * de jeitos opostos.
 *
 * Rodar:
 *   node --import ./scripts/test/register.mjs --test scripts/test/chargeMode.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
    normalizarChargeMode,
    chargeModeDaCorrida,
    chargeModePeloValor,
    rotuloCobranca,
    cobra,
} = await import("@/lib/chargeMode");
const { validarRecebimento, AVISO_CONFERIR_SEM_METODO } = await import("@/lib/receipt");

// --- lendo o que vem de fora (PDV, formulário) ------------------------------

test("os três valores passam inteiros", () => {
    assert.equal(normalizarChargeMode("receber", 0), "receber");
    assert.equal(normalizarChargeMode("conferir", 0), "conferir");
    assert.equal(normalizarChargeMode("pago", 50), "pago");
});

test("PDV que não manda nada cai na régua antiga (value > 0 = a receber)", () => {
    assert.equal(normalizarChargeMode(undefined, 50), "receber");
    assert.equal(normalizarChargeMode(undefined, 0), "pago");
    assert.equal(normalizarChargeMode(null, null), "pago");
});

test("lixo no campo também cai na régua antiga, sem estourar", () => {
    assert.equal(normalizarChargeMode({ oi: 1 }, 30), "receber");
    assert.equal(normalizarChargeMode(42, 0), "pago");
});

test("PDV que escreve em português é entendido", () => {
    assert.equal(normalizarChargeMode("A Receber", 0), "receber");
    assert.equal(normalizarChargeMode("conferir pix", 0), "conferir");
    assert.equal(normalizarChargeMode("PAGO", 99), "pago");
});

// --- corrida já gravada -----------------------------------------------------

test("corrida antiga (coluna NULL) continua valendo pela régua do valor", () => {
    assert.equal(chargeModeDaCorrida({ chargeMode: null, value: 80 }), "receber");
    assert.equal(chargeModeDaCorrida({ chargeMode: null, value: 0 }), "pago");
    assert.equal(chargeModePeloValor(0), "pago");
});

test("corrida nova manda na coluna, mesmo com valor zerado", () => {
    assert.equal(chargeModeDaCorrida({ chargeMode: "conferir", value: 0 }), "conferir");
    assert.equal(chargeModeDaCorrida({ chargeMode: "pago", value: 100 }), "pago");
});

test("cobra() separa quem tem valor em aberto de quem não tem", () => {
    assert.equal(cobra("receber"), true);
    assert.equal(cobra("conferir"), true);
    assert.equal(cobra("pago"), false);
    assert.equal(cobra(null), false);
});

// --- o que o motoboy lê no card --------------------------------------------

test("a etiqueta do card diz o que fazer, com o valor quando existe", () => {
    assert.equal(rotuloCobranca("receber", 12.5), "💵 Receber R$ 12,50");
    assert.equal(rotuloCobranca("conferir", 12.5), "🔎 Conferir Pix R$ 12,50");
    assert.equal(rotuloCobranca("pago", 0), "✅ Pago");
});

test("loja que esconde o valor do motoboy perde o número, não o aviso", () => {
    assert.equal(rotuloCobranca("receber", null), "💵 Receber do cliente");
    assert.equal(rotuloCobranca("conferir", null), "🔎 Conferir Pix da loja");
});

// --- a régua do servidor na hora de finalizar -------------------------------

test('"a conferir" marcado como recebido SEM método é recusado', () => {
    // PIX da loja e dinheiro na mão do motoboy dão no mesmo receiptStatus e
    // fazem coisas opostas com a carteira: sem o método não dá pra gravar.
    const r = validarRecebimento({ status: "recebido", amount: 100 }, 100, "conferir");
    assert.equal(r.error, AVISO_CONFERIR_SEM_METODO);
});

test('"a conferir" com o Pix da loja confirmado passa', () => {
    const r = validarRecebimento({ status: "recebido", method: "pix" }, 100, "conferir");
    assert.equal(r.error, undefined);
    assert.equal(r.amount, 100, "sem valor digitado, vale o valor do pedido");
    assert.equal(r.method, "pix");
});

test('"a conferir" que virou dinheiro na porta passa como dinheiro', () => {
    const r = validarRecebimento({ status: "recebido", method: "dinheiro" }, 100, "conferir");
    assert.equal(r.error, undefined);
    assert.equal(r.method, "dinheiro");
    assert.equal(r.amount, 100);
});

test('"a conferir" com "não pagou" passa zerado e sem método', () => {
    const r = validarRecebimento({ status: "nao_recebido" }, 100, "conferir");
    assert.equal(r.error, undefined);
    assert.equal(r.amount, 0);
    assert.equal(r.method, null);
});

test('corrida "já paga" fecha com "nada a receber" sem pedir nada', () => {
    const r = validarRecebimento({ status: "nada_a_receber" }, 0, "pago");
    assert.equal(r.error, undefined);
    assert.equal(r.amount, 0);
});

test('"recebi mesmo assim" numa corrida paga continua exigindo valor e método', () => {
    const semValor = validarRecebimento({ status: "valor_diferente", method: "dinheiro" }, 0, "pago");
    assert.match(semValor.error, /Digite quanto/);

    const ok = validarRecebimento({ status: "valor_diferente", amount: "30,00", method: "dinheiro" }, 0, "pago");
    assert.equal(ok.error, undefined);
    assert.equal(ok.amount, 30);
});

test('a frase de "sem método" continua a antiga fora do modo conferir', () => {
    const r = validarRecebimento({ status: "recebido", amount: 10 }, 10, "receber");
    assert.match(r.error, /Informe como recebeu/);
});
