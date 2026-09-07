/**
 * P1 da auditoria de frontend: a rota do motoboy era montada com o TEXTO do
 * endereço, então o Google geocodificava de novo e ignorava o pino que o caixa
 * tinha arrastado na tela de conferência.
 *
 * Rodar:
 *   node --import ./scripts/test/register.mjs --test scripts/test/mapsLink.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const { temCoordenada, alvoDoMaps, linkNavegacao, linkRota } = await import("@/lib/mapsLink");

test("coordenada de verdade é reconhecida", () => {
    assert.equal(temCoordenada({ lat: -19.75, lng: -47.93, address: "x" }), true);
});

test("lat/lng zerados NÃO contam como coordenada (é o que o banco grava quando não achou)", () => {
    assert.equal(temCoordenada({ lat: 0, lng: 0, address: "x" }), false);
    assert.equal(temCoordenada({ lat: -19.75, lng: 0, address: "x" }), false);
});

test("lat/lng nulos não contam", () => {
    assert.equal(temCoordenada({ lat: null, lng: null, address: "x" }), false);
    assert.equal(temCoordenada({ address: "x" }), false);
});

test("com pino, o alvo é lat,lng — não o texto", () => {
    assert.equal(alvoDoMaps({ lat: -19.75, lng: -47.93, address: "Rua A, 100" }), "-19.75,-47.93");
});

test("sem pino, cai no endereço escrito", () => {
    assert.equal(alvoDoMaps({ lat: 0, lng: 0, address: "Rua A, 100" }), "Rua A, 100");
});

test("link de navegação de uma entrega usa a coordenada", () => {
    const url = linkNavegacao({ lat: -19.75, lng: -47.93, address: "Rua A, 100" });
    assert.equal(url, "https://www.google.com/maps/dir/?api=1&destination=-19.75%2C-47.93");
});

test("link de navegação sem coordenada codifica o endereço", () => {
    const url = linkNavegacao({ lat: 0, lng: 0, address: "Rua A, 100 - Uberaba" });
    assert.equal(url, "https://www.google.com/maps/dir/?api=1&destination=Rua%20A%2C%20100%20-%20Uberaba");
});

test("rota: a última parada vira destino e as outras viram waypoints, na ordem", () => {
    const url = linkRota([
        { lat: -19.1, lng: -47.1, address: "A" },
        { lat: -19.2, lng: -47.2, address: "B" },
        { lat: -19.3, lng: -47.3, address: "C" },
    ]);
    assert.ok(url.includes("destination=-19.3%2C-47.3"), url);
    assert.ok(url.includes("waypoints=-19.1%2C-47.1%7C-19.2%2C-47.2"), url);
});

test("rota mistura coordenada e endereço, ponto a ponto", () => {
    const url = linkRota([
        { lat: 0, lng: 0, address: "Rua Sem Pino" },
        { lat: -19.3, lng: -47.3, address: "C" },
    ]);
    assert.ok(url.includes("destination=-19.3%2C-47.3"), url);
    assert.ok(url.includes("waypoints=Rua%20Sem%20Pino"), url);
});

test("rota de uma parada só não põe waypoints vazio", () => {
    const url = linkRota([{ lat: -19.3, lng: -47.3, address: "C" }]);
    assert.equal(url, "https://www.google.com/maps/dir/?api=1&destination=-19.3%2C-47.3");
    assert.ok(!url.includes("waypoints"));
});

test("rota vazia devolve string vazia (a tela não mostra botão nenhum)", () => {
    assert.equal(linkRota([]), "");
});
