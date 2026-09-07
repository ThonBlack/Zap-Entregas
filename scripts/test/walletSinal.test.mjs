/**
 * P1 da auditoria de frontend: o MESMO lançamento aparecia "+ R$ 300 verde" no
 * card de confirmações e "− R$ 300 vermelho" no extrato. As duas telas agora
 * leem o sinal, a cor e a frase daqui.
 *
 * Rodar:
 *   node --import ./scripts/test/register.mjs --test scripts/test/walletSinal.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { efeitoNoSaldo, formatBRL } = await import("@/lib/wallet-shared");

test("crédito é verde com '+' (a loja passa a dever mais pro motoboy)", () => {
    const e = efeitoNoSaldo("credit", 300);
    assert.equal(e.sinal, "+");
    assert.equal(e.cor, "green");
});

test("débito é vermelho com '−' — o 'paguei R$ 300' ABATE do que a loja deve", () => {
    const e = efeitoNoSaldo("debit", 300);
    assert.equal(e.sinal, "−");
    assert.equal(e.cor, "red");
    // formatBRL usa espaço fino entre "R$" e o número — comparar com o próprio
    // formatBRL evita um teste que quebra por causa de um caractere invisível.
    assert.equal(e.frase, `Abate ${formatBRL(300)} do que a loja te deve`);
});

test("a frase muda conforme quem está lendo", () => {
    assert.equal(
        efeitoNoSaldo("credit", 50, "loja").frase,
        `Aumenta ${formatBRL(50)} no que você deve ao motoboy`
    );
});

test("valor negativo não vira '−−': o sinal vem do tipo, o número vai em módulo", () => {
    const e = efeitoNoSaldo("debit", -300);
    assert.equal(e.frase.includes("-"), false);
    assert.ok(e.frase.includes(formatBRL(300)));
});
