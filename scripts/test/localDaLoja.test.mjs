/**
 * Onde a loja fica (shop_lat/shop_lng, endereço, pino no mapa) é dado do
 * negócio de outra pessoa: só a própria loja, os motoboys DELA e o admin.
 *
 * Duas coisas são provadas aqui:
 *  (a) a regra em si (src/lib/team.ts), inclusive a peneira que APAGA a
 *      coordenada do payload em vez de escondê-la na tela;
 *  (b) que a página pública de rastreio não carrega nada de shop_settings —
 *      o cliente vê o motoboy e o destino dele, não de onde o pedido saiu.
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/localDaLoja.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(fileURLToPath(import.meta.url), "../../..");

const { podeVerLocalDaLoja, localDaLojaVisivel } = await import("@/lib/team");

const LOJA_A = 2;
const LOJA_B = 20;
const CONFIG = { shopLat: -19.7472, shopLng: -47.9381 };

const loja = (id) => ({ id, role: "shopkeeper" });
const motoboy = (id, shopkeeperId) => ({ id, role: "motoboy", shopkeeperId });
const admin = { id: 1, role: "admin" };

// --- (a) a regra -----------------------------------------------------------

test("a própria loja vê onde ela fica", () => {
    assert.equal(podeVerLocalDaLoja(loja(LOJA_A), LOJA_A), true);
});

test("uma loja NÃO vê onde a outra fica", () => {
    assert.equal(podeVerLocalDaLoja(loja(LOJA_B), LOJA_A), false);
});

test("o motoboy da equipe vê; o de outra loja, não", () => {
    assert.equal(podeVerLocalDaLoja(motoboy(3, LOJA_A), LOJA_A), true);
    assert.equal(podeVerLocalDaLoja(motoboy(4, LOJA_B), LOJA_A), false);
});

test("motoboy sem loja não vê a de ninguém", () => {
    assert.equal(podeVerLocalDaLoja(motoboy(30, null), LOJA_A), false);
});

test("admin vê todas", () => {
    assert.equal(podeVerLocalDaLoja(admin, LOJA_A), true);
    assert.equal(podeVerLocalDaLoja(admin, LOJA_B), true);
});

test("visitante sem sessão nunca vê (é o caso do rastreio público)", () => {
    assert.equal(podeVerLocalDaLoja(null, LOJA_A), false);
    assert.equal(podeVerLocalDaLoja(undefined, LOJA_A), false);
});

test("corrida sem loja no cadastro não revela nada", () => {
    assert.equal(podeVerLocalDaLoja(admin, null), false);
});

// --- a peneira do payload ---------------------------------------------------

test("quem pode ver recebe a coordenada", () => {
    const visto = localDaLojaVisivel(motoboy(3, LOJA_A), LOJA_A, CONFIG);
    assert.deepEqual(visto, CONFIG);
});

test("quem não pode recebe null — o dado nem sai do servidor", () => {
    const visto = localDaLojaVisivel(motoboy(4, LOJA_B), LOJA_A, CONFIG);
    assert.deepEqual(visto, { shopLat: null, shopLng: null });
    // Sem isto a coordenada viajaria no HTML e "esconder" seria só cosmético.
    assert.equal(JSON.stringify(visto).includes("19.7"), false);
});

test("sem configuração salva também não inventa coordenada", () => {
    assert.deepEqual(localDaLojaVisivel(admin, LOJA_A, null), { shopLat: null, shopLng: null });
});

// --- (b) a página pública de rastreio --------------------------------------

test("o rastreio público não toca em shop_settings nem em coordenada da loja", () => {
    const bruto = fs.readFileSync(path.join(RAIZ, "src", "app", "tracking", "[id]", "page.tsx"), "utf8");
    // Os comentários da própria tela falam disso: o que interessa é o CÓDIGO.
    const pagina = bruto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    assert.equal(/shopSettings|shop_settings/.test(pagina), false,
        "a tela do cliente não pode carregar a configuração da loja");
    assert.equal(/shopLat|shopLng/.test(pagina), false,
        "nenhuma coordenada da loja pode chegar no navegador do cliente");

    // O mapa do cliente recebe só a posição do motoboy.
    assert.match(pagina, /motoboyLocation=\{motoboyLocation\}/);
});

test("a action que devolve posição de motoboy exige sessão", () => {
    const acoes = fs.readFileSync(path.join(RAIZ, "src", "app", "actions", "tracking.ts"), "utf8");
    const corpo = acoes.slice(acoes.indexOf("export async function getMotoboyLocationAction"));

    // Tudo que é exportado de um "use server" é um endereço público: sem esta
    // linha dava pra varrer 1, 2, 3… e ler a localização ao vivo de todo mundo.
    assert.match(corpo, /getAuthUserWithRole/, "a action precisa checar quem está chamando");
    assert.match(corpo, /carregarMotoboyGerenciado/, "lojista só enxerga a equipe dele");
});
