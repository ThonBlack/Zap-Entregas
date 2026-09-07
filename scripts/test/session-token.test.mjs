/**
 * P0 da auditoria de segurança: o cookie de "2FA pendente" era um cookie de
 * sessão válido. Quem fizesse login com senha certa recebia o `2fa_pending`,
 * colava o valor no cookie `session` e entrava sem digitar o código.
 *
 * Rodar:
 *   SESSION_SECRET=<32+ chars> node --import ./scripts/test/register.mjs --test scripts/test/session-token.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET ||= "chave-de-teste-com-mais-de-32-caracteres-ok";

const { buildToken, parseToken, TWOFA_MAX_AGE_MS, TOKEN_MAX_AGE_MS } =
    await import("@/lib/sessionToken");

test("token de sessão vale como sessão", () => {
    const t = buildToken(7, "session");
    assert.equal(parseToken(t, "session"), 7);
});

test("token de 2FA vale como 2FA", () => {
    const t = buildToken(7, "2fa");
    assert.equal(parseToken(t, "2fa"), 7);
});

test("token de 2FA NÃO serve de sessão (o furo do P0)", () => {
    const pendente = buildToken(7, "2fa");
    assert.equal(parseToken(pendente, "session"), null);
});

test("token de sessão NÃO serve de 2FA pendente", () => {
    const sessao = buildToken(7, "session");
    assert.equal(parseToken(sessao, "2fa"), null);
});

test("formato do token de sessão continua o antigo (ninguém cai no login)", () => {
    // Sessões já emitidas são <id>.<ts>.<assinatura>; se o formato mudasse,
    // todo mundo logado hoje seria deslogado no deploy.
    const t = buildToken(4, "session");
    const partes = t.split(".");
    assert.equal(partes.length, 3);
    assert.equal(partes[0], "4");
});

test("token de 2FA carrega o propósito na assinatura", () => {
    const t = buildToken(4, "2fa");
    const partes = t.split(".");
    assert.equal(partes.length, 4);
    assert.equal(partes[0], "2fa");
});

test("trocar o prefixo na mão não passa (assinatura confere o propósito)", () => {
    const sessao = buildToken(9, "session");
    assert.equal(parseToken(`2fa.${sessao}`, "2fa"), null);

    const pendente = buildToken(9, "2fa");
    const semPrefixo = pendente.split(".").slice(1).join(".");
    assert.equal(parseToken(semPrefixo, "session"), null);
});

test("2FA pendente vence em 5 minutos, não em 30 dias", () => {
    const agora = Date.now();
    const seisMinutos = agora - 6 * 60 * 1000;

    // Reconstrói um token válido com data antiga usando o próprio builder,
    // congelando o relógio no momento da emissão.
    const relogio = Date.now;
    Date.now = () => seisMinutos;
    const velho = buildToken(3, "2fa");
    const sessaoVelha = buildToken(3, "session");
    Date.now = relogio;

    assert.equal(parseToken(velho, "2fa"), null, "pendente de 6 min tinha que ser recusado");
    assert.equal(parseToken(sessaoVelha, "session"), 3, "sessão de 6 min continua válida");
    assert.ok(TWOFA_MAX_AGE_MS < TOKEN_MAX_AGE_MS);
});

test("lixo e assinatura errada não passam", () => {
    assert.equal(parseToken("", "session"), null);
    assert.equal(parseToken(undefined, "session"), null);
    assert.equal(parseToken("7.123.assinaturaerrada", "session"), null);
    assert.equal(parseToken("2fa.7.123.assinaturaerrada", "2fa"), null);
});
