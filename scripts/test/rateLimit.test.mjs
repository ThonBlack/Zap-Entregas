/**
 * Testes do limite de tentativas (src/lib/rateLimit.ts).
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/rateLimit.test.mjs
 *
 * O relógio é passado por parâmetro (`agora`), então nenhum teste espera de
 * verdade — dá pra "andar no tempo" sem timer.
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
    registrarTentativa,
    limparTentativas,
    zerarTudo,
    quantidadeDeChaves,
    mensagemDeEspera,
    ipDeQuemChamou,
    aplicarLimite,
    limparLimite,
    LIMITES,
} = await import("@/lib/rateLimit");

const cabecalhos = (obj) => ({ get: (nome) => obj[nome.toLowerCase()] ?? null });

test("deixa passar até o máximo e barra da próxima em diante", () => {
    zerarTudo();
    const t0 = 1_000_000;
    for (let i = 1; i <= 3; i++) {
        const r = registrarTentativa("x", 3, 60_000, t0 + i);
        assert.equal(r.permitido, true, `tentativa ${i} deveria passar`);
        assert.equal(r.restantes, 3 - i);
    }
    const barrada = registrarTentativa("x", 3, 60_000, t0 + 4);
    assert.equal(barrada.permitido, false);
    assert.ok(barrada.esperarSegundos > 0, "tem que dizer quanto esperar");
});

test("janela DESLIZANTE: não libera tudo de uma vez quando 'vira a hora'", () => {
    zerarTudo();
    const t0 = 1_000_000;
    // 3 tentativas no começo da janela de 60s
    for (let i = 0; i < 3; i++) registrarTentativa("y", 3, 60_000, t0 + i * 1000);
    assert.equal(registrarTentativa("y", 3, 60_000, t0 + 5_000).permitido, false);

    // 61s depois da PRIMEIRA, ela saiu da janela — sobra espaço pra uma só.
    const passa = registrarTentativa("y", 3, 60_000, t0 + 61_000);
    assert.equal(passa.permitido, true, "a mais antiga venceu, abre uma vaga");
    const barra = registrarTentativa("y", 3, 60_000, t0 + 61_100);
    assert.equal(barra.permitido, false, "as outras duas ainda contam");
});

test("insistir enquanto está bloqueado estica o bloqueio", () => {
    zerarTudo();
    const t0 = 2_000_000;
    for (let i = 0; i < 5; i++) registrarTentativa("z", 2, 60_000, t0 + i * 100);
    const r = registrarTentativa("z", 2, 60_000, t0 + 30_000);
    assert.equal(r.permitido, false);
    // a mais antiga é do t0, então falta ~30s; se as tentativas barradas não
    // contassem, a espera seria menor a cada chamada.
    assert.ok(r.esperarSegundos >= 29 && r.esperarSegundos <= 31, `esperar=${r.esperarSegundos}`);
});

test("chaves diferentes não se atrapalham", () => {
    zerarTudo();
    const t0 = 3_000_000;
    registrarTentativa("a", 1, 60_000, t0);
    assert.equal(registrarTentativa("a", 1, 60_000, t0 + 1).permitido, false);
    assert.equal(registrarTentativa("b", 1, 60_000, t0 + 2).permitido, true, "outra chave começa do zero");
});

test("limpar zera o contador (login que deu certo)", () => {
    zerarTudo();
    const t0 = 4_000_000;
    for (let i = 0; i < 10; i++) registrarTentativa("login:ip", 3, 60_000, t0 + i);
    assert.equal(registrarTentativa("login:ip", 3, 60_000, t0 + 20).permitido, false);
    limparTentativas("login:ip");
    assert.equal(registrarTentativa("login:ip", 3, 60_000, t0 + 30).permitido, true);
});

test("a poda joga fora chave velha e segura a memória", () => {
    zerarTudo();
    const t0 = 5_000_000;
    for (let i = 0; i < 50; i++) registrarTentativa(`velha${i}`, 5, 60_000, t0 + i);
    assert.equal(quantidadeDeChaves(), 50);
    // 2 horas depois (passou do intervalo da poda E da vida máxima de 1h)
    registrarTentativa("nova", 5, 60_000, t0 + 2 * 60 * 60 * 1000);
    assert.equal(quantidadeDeChaves(), 1, "só a nova sobrou");
});

test("regras nomeadas: login 10/15min, 2FA 5, lojista 5/h, webhook 120/min", () => {
    assert.deepEqual(LIMITES.login, { maximo: 10, janelaMs: 15 * 60_000 });
    assert.equal(LIMITES.doisFatores.maximo, 5);
    assert.deepEqual(LIMITES.conviteLojista, { maximo: 5, janelaMs: 60 * 60_000 });
    assert.deepEqual(LIMITES.webhookPdv, { maximo: 120, janelaMs: 60_000 });
    assert.equal(LIMITES.places.maximo, 60);
    assert.equal(LIMITES.convite.maximo, 10);
    assert.equal(LIMITES.senha.maximo, 10);
});

test("aplicarLimite usa a regra certa e separa por identificador", () => {
    zerarTudo();
    const t0 = 6_000_000;
    for (let i = 0; i < 5; i++) {
        assert.equal(aplicarLimite("conviteLojista", "1.2.3.4", t0 + i).permitido, true);
    }
    assert.equal(aplicarLimite("conviteLojista", "1.2.3.4", t0 + 6).permitido, false, "6º chute barra");
    assert.equal(aplicarLimite("conviteLojista", "9.9.9.9", t0 + 7).permitido, true, "outro IP passa");
    // a mesma chave em regras diferentes é contada separado
    assert.equal(aplicarLimite("login", "1.2.3.4", t0 + 8).permitido, true);
    limparLimite("conviteLojista", "1.2.3.4");
    assert.equal(aplicarLimite("conviteLojista", "1.2.3.4", t0 + 9).permitido, true);
});

test("IP: pega o primeiro de x-forwarded-for (o resto são os proxies)", () => {
    assert.equal(ipDeQuemChamou(cabecalhos({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 172.17.0.1" })), "203.0.113.7");
    assert.equal(ipDeQuemChamou(cabecalhos({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
    assert.equal(ipDeQuemChamou(cabecalhos({})), "desconhecido");
    // cabeçalho gigante forjado não vira chave gigante no mapa
    const enorme = "9".repeat(5000);
    assert.ok(ipDeQuemChamou(cabecalhos({ "x-forwarded-for": enorme })).length <= 60);
});

test("mensagem em PT-BR, sem jargão, em segundos ou minutos", () => {
    assert.equal(mensagemDeEspera(30), "Muitas tentativas. Espere 30 segundos.");
    assert.equal(mensagemDeEspera(1), "Muitas tentativas. Espere 1 segundo.", "singular");
    assert.equal(mensagemDeEspera(0), "Muitas tentativas. Espere 1 segundo.");
    assert.equal(mensagemDeEspera(600), "Muitas tentativas. Espere 10 minutos.");
    assert.equal(mensagemDeEspera(900), "Muitas tentativas. Espere 15 minutos.");
    assert.equal(mensagemDeEspera(120), "Muitas tentativas. Espere 2 minutos.");
    // nada de "rate limit", "throttle" ou "429" na cara do motoboy
    assert.doesNotMatch(mensagemDeEspera(300), /limit|throttle|429|erro/i);
});

test("Headers de verdade (o objeto do Next) também serve", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9" });
    assert.equal(ipDeQuemChamou(h), "203.0.113.9");
});
