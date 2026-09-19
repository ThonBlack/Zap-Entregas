/**
 * Lançamento atrasado e a loja dona da corrida.
 *
 * O que está sendo protegido (as duas coisas que deram errado em produção):
 *
 *  (a) O dono usa o app logado como ADMIN. O cadastro gravava "loja = quem
 *      clicou", então a corrida dele nascia no nome do admin: ficava fora do
 *      Resumo do dia da loja, sumia do histórico dela e ganhava uma numeração
 *      "Corrida N" separada.
 *
 *  (b) O formulário não tinha campo de data. As corridas de terça e quarta,
 *      digitadas na quinta, caíram todas na quinta — e o "Marcar entregue" da
 *      loja ainda jogava o `delivered_at` em "agora", empurrando a corrida
 *      atrasada pro dia errado do fechamento.
 *
 * Tudo aqui é PURO: nenhuma dessas funções encosta no banco.
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/lancamentoAtrasado.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
    interpretarDataDaCorrida,
    limitesDoCampoData,
    instanteDaFinalizacao,
    MAX_DIAS_ATRAS,
    AVISO_DATA_FUTURA,
    AVISO_DATA_ANTIGA,
    AVISO_DATA_ILEGIVEL,
} = await import("@/lib/lancamentoRetroativo");
const { lojaDaNovaCorrida, motoboyServeALoja, AVISO_ESCOLHA_A_LOJA } =
    await import("@/lib/lojaDaCorrida");
const { diaBrasiliaDe, instanteNoDiaBrasilia, horaBrasiliaDe, somaMinutos } =
    await import("@/lib/datetime");

/** Quinta, 17/09/2026, 14h30 de Brasília (17h30 UTC). */
const QUINTA_1430 = new Date("2026-09-17T17:30:00.000Z");
/** 23h30 de Brasília de quinta — em UTC já é sexta. */
const QUINTA_2330 = new Date("2026-09-18T02:30:00.000Z");

// =========================================================================
// A régua de fuso (src/lib/datetime.ts)
// =========================================================================

test("a hora de Brasília sai do instante, não do relógio da máquina", () => {
    assert.equal(horaBrasiliaDe(QUINTA_1430), "14:30:00.000");
    assert.equal(horaBrasiliaDe(QUINTA_2330), "23:30:00.000");
});

test("um dia passado + a hora de agora vira o instante certo em UTC", () => {
    // Terça, 15/09, às 14h30 de Brasília = 17h30 UTC do mesmo dia.
    assert.equal(
        instanteNoDiaBrasilia("2026-09-15", QUINTA_1430),
        "2026-09-15T17:30:00.000Z",
    );
    // 23h30 de Brasília de terça = 02h30 UTC de QUARTA — e o dia de Brasília
    // continua sendo terça, que é o que o Resumo do dia usa.
    const tarde = instanteNoDiaBrasilia("2026-09-15", QUINTA_2330);
    assert.equal(tarde, "2026-09-16T02:30:00.000Z");
    assert.equal(diaBrasiliaDe(tarde), "2026-09-15");

    assert.equal(instanteNoDiaBrasilia("2026-02-30", QUINTA_1430), null, "30/02 não existe");
});

// =========================================================================
// (b) o campo "Data da corrida"
// =========================================================================

test("vazio é hoje — o comportamento de sempre", () => {
    for (const vazio of ["", "   ", null, undefined]) {
        const r = interpretarDataDaCorrida(vazio, QUINTA_1430);
        assert.equal(r.ok, true);
        assert.equal(r.dia, "2026-09-17");
        assert.equal(r.retroativa, false, "corrida de hoje não é lançamento atrasado");
        assert.equal(r.quandoISO, QUINTA_1430.toISOString());
    }
});

test("o dia de hoje escrito à mão também não é retroativo", () => {
    const r = interpretarDataDaCorrida("2026-09-17", QUINTA_1430);
    assert.equal(r.ok, true);
    assert.equal(r.retroativa, false);
    assert.equal(r.quandoISO, QUINTA_1430.toISOString());
});

test("a corrida de terça, digitada na quinta, fica em terça com a hora de agora", () => {
    const r = interpretarDataDaCorrida("2026-09-15", QUINTA_1430);
    assert.equal(r.ok, true);
    assert.equal(r.dia, "2026-09-15");
    assert.equal(r.retroativa, true);
    assert.equal(r.quandoISO, "2026-09-15T17:30:00.000Z");
    assert.equal(diaBrasiliaDe(r.quandoISO), "2026-09-15", "o dia de Brasília é o da corrida");
});

test("lançar de madrugada não empurra a corrida pro dia seguinte", () => {
    // 23h30 de quinta: em UTC já é sexta. Se a conta fosse em UTC, a corrida de
    // quarta viraria quinta.
    const r = interpretarDataDaCorrida("2026-09-16", QUINTA_2330);
    assert.equal(r.ok, true);
    assert.equal(diaBrasiliaDe(r.quandoISO), "2026-09-16");
});

test("futuro não entra", () => {
    const r = interpretarDataDaCorrida("2026-09-18", QUINTA_1430);
    assert.equal(r.ok, false);
    assert.equal(r.erro, AVISO_DATA_FUTURA);
});

test(`mais de ${MAX_DIAS_ATRAS} dias atrás não entra`, () => {
    // O limite EXATO ainda passa; um dia antes dele, não.
    const noLimite = interpretarDataDaCorrida("2026-07-19", QUINTA_1430); // 60 dias
    assert.equal(noLimite.ok, true, "o último dia da janela ainda vale");
    assert.equal(noLimite.retroativa, true);

    const velha = interpretarDataDaCorrida("2026-07-18", QUINTA_1430); // 61 dias
    assert.equal(velha.ok, false);
    assert.equal(velha.erro, AVISO_DATA_ANTIGA);

    // O erro clássico de digitação: o ano passado.
    assert.equal(interpretarDataDaCorrida("2025-09-15", QUINTA_1430).ok, false);
});

test("data ilegível é erro na tela, nunca uma data inventada", () => {
    for (const lixo of ["ontem", "15/09/2026", "2026-9-15", "2026-02-30", 20260915]) {
        const r = interpretarDataDaCorrida(lixo, QUINTA_1430);
        assert.equal(r.ok, false, `"${lixo}" não podia passar`);
        assert.equal(r.erro, AVISO_DATA_ILEGIVEL);
    }
});

test("os limites do campo na tela são a mesma régua do servidor", () => {
    const { min, max } = limitesDoCampoData("2026-09-17");
    assert.equal(max, "2026-09-17", "o máximo é hoje");
    assert.equal(min, "2026-07-19");
    // O que a tela deixa escolher é exatamente o que o servidor aceita.
    assert.equal(interpretarDataDaCorrida(min, QUINTA_1430).ok, true);
    assert.equal(interpretarDataDaCorrida(max, QUINTA_1430).ok, true);
});

// =========================================================================
// (b) finalizar corrida atrasada — em que dia cai o "entregue"
// =========================================================================

/** Terça, 15/09, 14h30 de Brasília. */
const CORRIDA_DE_TERCA = "2026-09-15T17:30:00.000Z";

test("o motoboy finaliza sempre em AGORA (ele entrega na rua, no dia)", () => {
    const quando = instanteDaFinalizacao({
        createdAt: CORRIDA_DE_TERCA,
        porLoja: false,
        agora: QUINTA_1430,
    });
    assert.equal(quando, QUINTA_1430.toISOString());
});

test("a loja fechando corrida de HOJE também cai em agora", () => {
    const quando = instanteDaFinalizacao({
        createdAt: "2026-09-17T13:00:00.000Z",
        porLoja: true,
        agora: QUINTA_1430,
    });
    assert.equal(quando, QUINTA_1430.toISOString());
});

test("a loja fechando corrida de TERÇA joga a entrega em terça, não na quinta", () => {
    const quando = instanteDaFinalizacao({
        createdAt: CORRIDA_DE_TERCA,
        porLoja: true,
        agora: QUINTA_1430,
    });
    assert.equal(quando, somaMinutos(CORRIDA_DE_TERCA, 1), "um minuto depois do cadastro");
    assert.equal(diaBrasiliaDe(quando), "2026-09-15", "é o dia da corrida que manda");
    assert.ok(quando > CORRIDA_DE_TERCA, "a entrega nunca vem antes do cadastro");
});

test("corrida das 23h30 fechada pela loja continua no dia de Brasília dela", () => {
    // 23h30 de terça em Brasília = 02h30 UTC de quarta.
    const quando = instanteDaFinalizacao({
        createdAt: "2026-09-16T02:30:00.000Z",
        porLoja: true,
        agora: QUINTA_1430,
    });
    assert.equal(diaBrasiliaDe(quando), "2026-09-15");
});

test("formato antigo do banco (sem 'Z') vale igual", () => {
    const quando = instanteDaFinalizacao({
        createdAt: "2026-09-15 17:30:00",
        porLoja: true,
        agora: QUINTA_1430,
    });
    assert.equal(diaBrasiliaDe(quando), "2026-09-15");
});

test("sem data legível na corrida, cai em agora (e não estoura)", () => {
    for (const ruim of [null, undefined, "", "sei lá"]) {
        const quando = instanteDaFinalizacao({ createdAt: ruim, porLoja: true, agora: QUINTA_1430 });
        assert.equal(quando, QUINTA_1430.toISOString());
    }
});

// =========================================================================
// (a) de quem é a corrida
// =========================================================================

const LOJISTA = { id: 3, role: "shopkeeper" };
const ADMIN = { id: 1, role: "admin" };

test("lojista é sempre a própria loja — o campo do formulário é ignorado", () => {
    assert.deepEqual(lojaDaNovaCorrida(LOJISTA, ""), { ok: true, shopkeeperId: 3 });
    // Mesmo mandando o id de OUTRA loja na mão, a corrida sai no nome dele.
    assert.deepEqual(lojaDaNovaCorrida(LOJISTA, "7"), { ok: true, shopkeeperId: 3 });
    assert.deepEqual(lojaDaNovaCorrida(LOJISTA, 7), { ok: true, shopkeeperId: 3 });
});

test("admin sem escolher a loja é barrado com aviso claro", () => {
    for (const nada of ["", "   ", null, undefined, "0", "-2", "abc", "2,5"]) {
        const r = lojaDaNovaCorrida(ADMIN, nada);
        assert.equal(r.ok, false, `"${nada}" não podia virar loja`);
        assert.equal(r.erro, AVISO_ESCOLHA_A_LOJA);
    }
});

test("admin com a loja escolhida grava a corrida NAQUELA loja, não na dele", () => {
    assert.deepEqual(lojaDaNovaCorrida(ADMIN, "3"), { ok: true, shopkeeperId: 3 });
    assert.deepEqual(lojaDaNovaCorrida(ADMIN, 3), { ok: true, shopkeeperId: 3 });
    // O id do próprio admin só entra se ele escolher — nunca por padrão.
    assert.notEqual(lojaDaNovaCorrida(ADMIN, "3").shopkeeperId, ADMIN.id);
});

test("o motoboy destinado tem que ser da equipe DAQUELA loja", () => {
    assert.equal(motoboyServeALoja({ shopkeeperId: 3 }, 3), true);
    assert.equal(motoboyServeALoja({ shopkeeperId: 7 }, 3), false, "motoboy de outra loja, não");
    // Motoboy "da casa" (sem loja, só o admin cadastra) serve pra qualquer uma.
    assert.equal(motoboyServeALoja({ shopkeeperId: null }, 3), true);
    assert.equal(motoboyServeALoja({}, 3), true);
});
