/**
 * "Destinar a corrida a um motoboy" (src/lib/deliveryAssign.ts).
 *
 * Antes só existia fila aberta: a loja cadastrava e torcia pra alguém pegar.
 * Agora ela escolhe — e a parte delicada é a JANELA: depois que o motoboy
 * coletou o pedido, a mercadoria está com ele; trocar o dono aí jogaria a taxa
 * na carteira de quem não fez a corrida.
 *
 * Rodar:
 *   node --import ./scripts/test/register.mjs --test scripts/test/deliveryAssign.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { planejarDestino } = await import("@/lib/deliveryAssign");

const AGORA = "2026-09-14T12:00:00.000Z";
const JOAO = { id: 7, name: "João" };
const MARIA = { id: 8, name: "Maria" };

const corrida = (o = {}) => ({ status: "pending", motoboyId: null, observation: null, ...o });

test("corrida na fila vai pro motoboy escolhido e já nasce aceita", () => {
    const p = planejarDestino(corrida(), JOAO, AGORA);
    assert.equal(p.ok, true);
    assert.equal(p.jaEra, false);
    assert.equal(p.motoboyId, 7);
    assert.equal(p.status, "assigned", "ele não precisa aceitar de novo o que a loja já deu pra ele");
    assert.equal(p.acceptedAt, AGORA);
});

test("o rastro fica na observação, junto com o que já estava escrito", () => {
    const p = planejarDestino(corrida({ observation: "portão azul" }), JOAO, AGORA);
    assert.equal(p.observation, "portão azul · destinada pela loja a João");
});

test("trocar de motoboy é permitido enquanto ninguém coletou", () => {
    const p = planejarDestino(corrida({ status: "assigned", motoboyId: 7 }), MARIA, AGORA);
    assert.equal(p.ok, true);
    assert.equal(p.motoboyId, 8);
    assert.equal(p.status, "assigned");
});

test("devolver pra fila tira o dono e volta pra 'pending'", () => {
    const p = planejarDestino(corrida({ status: "assigned", motoboyId: 7 }), null, AGORA);
    assert.equal(p.ok, true);
    assert.equal(p.motoboyId, null);
    assert.equal(p.status, "pending");
    assert.equal(p.acceptedAt, null, "o carimbo de aceite não pode sobrar de um dono que saiu");
});

test("devolver pra fila NÃO carimba nada novo na observação", () => {
    const p = planejarDestino(corrida({ status: "assigned", motoboyId: 7, observation: "x" }), null, AGORA);
    assert.equal(p.observation, "x");
});

test("depois de coletado não troca mais — a mercadoria já está com alguém", () => {
    const p = planejarDestino(corrida({ status: "picked_up", motoboyId: 7 }), MARIA, AGORA);
    assert.equal(p.ok, false);
    assert.match(p.erro, /já pegou o pedido/i);
});

test("corrida entregue ou cancelada não se destina", () => {
    for (const status of ["delivered", "canceled", "draft"]) {
        const p = planejarDestino(corrida({ status }), JOAO, AGORA);
        assert.equal(p.ok, false, `${status} deveria ser recusado`);
        assert.match(p.erro, /não está mais aberta/i);
    }
});

test("destinar pra quem já está com ela não muda nada (clique repetido)", () => {
    const p = planejarDestino(corrida({ status: "assigned", motoboyId: 7, observation: "obs" }), JOAO, AGORA);
    assert.equal(p.ok, true);
    assert.equal(p.jaEra, true, "sem isso o carimbo 'destinada pela loja' se repetiria na observação");
});

test("mandar pra fila uma corrida que já está na fila também não muda nada", () => {
    const p = planejarDestino(corrida(), null, AGORA);
    assert.equal(p.ok, true);
    assert.equal(p.jaEra, true);
});

test("observação gigante é cortada em 1000 (o tamanho da coluna)", () => {
    const p = planejarDestino(corrida({ observation: "a".repeat(1200) }), JOAO, AGORA);
    assert.equal(p.observation.length, 1000);
});
