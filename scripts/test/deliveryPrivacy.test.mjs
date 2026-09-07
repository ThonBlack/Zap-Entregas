/**
 * Testes do que um motoboy de outra loja pode ver (src/lib/deliveryPrivacy.ts).
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/deliveryPrivacy.test.mjs
 *
 * Conta pura: não encosta em banco.
 */
import test from "node:test";
import assert from "node:assert/strict";

const { resumoDoLocal, coordenadaAproximada, mascararParaOutraLoja, avisoDeCorridaNova } =
    await import("@/lib/deliveryPrivacy");

test("resumo do local: bairro e cidade, nunca a rua e o número", () => {
    const r = resumoDoLocal("Rua Vigário Silva, 143, Centro, Uberaba - MG");
    assert.equal(r, "Centro · Uberaba");
    assert.doesNotMatch(r, /143/, "o número da casa não pode aparecer");
    assert.doesNotMatch(r, /Vigário/, "o nome da rua não pode aparecer");
});

test("endereço curto: sobra a última parte, que é a cidade — nunca a rua", () => {
    // O leitor de endereço só separa as partes quando tem rua + número; sem isso
    // sobra a última parte depois da vírgula, que é sempre a cidade.
    const r = resumoDoLocal("Av. Leopoldino de Oliveira, Uberaba - MG");
    assert.equal(r, "Uberaba");
    assert.doesNotMatch(r, /Leopoldino/, "a rua fica de fora");

    // Sem vírgula não dá pra saber o que é: melhor não mostrar do que arriscar.
    assert.equal(resumoDoLocal("Uberaba"), "Endereço aparece quando você aceitar");
    assert.equal(resumoDoLocal("Rua Vigário Silva 143"), "Endereço aparece quando você aceitar");
});

test("endereço que o parser não entende não vira mentira", () => {
    assert.equal(resumoDoLocal(""), "Endereço aparece quando você aceitar");
    assert.equal(resumoDoLocal(null), "Endereço aparece quando você aceitar");
});

test("coordenada aproximada dá a quadra, não a casa", () => {
    // 3 casas decimais ≈ 110 metros
    assert.equal(coordenadaAproximada(-19.747213), -19.747);
    assert.equal(coordenadaAproximada(-47.938144), -47.938);
    assert.equal(coordenadaAproximada(0), null, "0 é 'não tem pino', não o meio do oceano");
    assert.equal(coordenadaAproximada(null), null);
    assert.equal(coordenadaAproximada(NaN), null);
});

test("mascarar tira nome, telefone, observação e o endereço completo", () => {
    const corrida = {
        id: 42,
        address: "Rua Vigário Silva, 143, Centro, Uberaba - MG",
        customerName: "Maria Silva",
        customerPhone: "(34) 99694-4103",
        observation: "Portão azul, cachorro bravo",
        lat: -19.747213,
        lng: -47.938144,
        value: 89.9,
    };
    const m = mascararParaOutraLoja(corrida, "Vapor Fumê");

    assert.equal(m.customerName, null);
    assert.equal(m.customerPhone, null);
    assert.equal(m.observation, null);
    assert.equal(m.address, "Centro · Uberaba");
    assert.equal(m.shopName, "Vapor Fumê", "a loja aparece: é o que ajuda a decidir");
    assert.equal(m.masked, true);
    assert.equal(m.id, 42, "o resto da corrida continua igual");
    assert.equal(m.value, 89.9);

    // nada do que foi escondido pode ter sobrado em algum canto do objeto
    const tudo = JSON.stringify(m);
    assert.doesNotMatch(tudo, /Maria/i);
    assert.doesNotMatch(tudo, /99694/);
    assert.doesNotMatch(tudo, /143/);
    assert.doesNotMatch(tudo, /cachorro/i);
    assert.doesNotMatch(tudo, /Vigário/i);
});

test("mascarar sem nome de loja não quebra", () => {
    const m = mascararParaOutraLoja(
        { address: "Centro, Uberaba - MG", customerName: "X", customerPhone: "1", observation: "y", lat: null, lng: null },
        null,
    );
    assert.equal(m.shopName, null);
    assert.equal(m.lat, null);
});

test("aviso do celular leva bairro, nunca endereço nem telefone", () => {
    const a = avisoDeCorridaNova("Rua Vigário Silva, 143, Centro, Uberaba - MG");
    assert.equal(a, "Nova corrida em Centro · Uberaba");
    assert.doesNotMatch(a, /143|Vigário/);

    assert.equal(avisoDeCorridaNova(""), "Abra o app pra ver os detalhes");
});
