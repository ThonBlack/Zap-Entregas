/**
 * A "Fila da loja" — a tela que o VENDEDOR abre dentro do painel do EpicStore,
 * autorizado só por um código na URL.
 *
 * O que está sendo protegido, e por que cada um importa:
 *
 *  (a) A SESSÃO. Ela é a única credencial dessa tela: o vendedor não tem conta
 *      no Zap. Se um código vencido continuasse valendo, a tela esquecida num
 *      PC do balcão seria uma porta aberta pra sempre.
 *
 *  (b) O ESCOPO DA LOJA. Um código da loja A não pode alcançar corrida da loja
 *      B — nem pra ler, nem pra cancelar. É a falha clássica de tela por token:
 *      valida o código e depois busca pelo id que veio da URL.
 *
 *  (c) AS REGRAS DE "PODE EDITAR / PODE CANCELAR". Depois que o motoboy coleta,
 *      o pedido está na rua: mudar o endereço por baixo o mandaria pra um lugar
 *      diferente do combinado, sem ele saber.
 *
 *  (d) NADA DE FINANCEIRO. A tela inteira é sobre o pedido, nunca sobre o
 *      acerto entre a loja e o motoboy. A lista de campos que a fila carrega é
 *      fechada justamente pra ninguém acrescentar a taxa sem perceber.
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/fila.test.mjs
 *
 * Banco DESCARTÁVEL: nada aqui encosta no de desenvolvimento nem no de produção.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";

const RAIZ = path.resolve(fileURLToPath(import.meta.url), "../../..");
const UTILS = path.join(RAIZ, "scripts", "utils");
const BANCO = path.join(os.tmpdir(), `zap-fila-${process.pid}.db`);

const LOJA_A = 2;
const LOJA_B = 20;

// --- monta o banco de teste ANTES de importar o código (o @/db lê a env no load)
fs.copyFileSync(path.join(RAIZ, "sqlite.db"), BANCO);
process.env.DATABASE_PATH = BANCO;

const migracoes = fs
    .readdirSync(UTILS)
    .filter((f) => /^add_.*\.js$/.test(f) || f === "make_phone_nullable.js")
    .sort();
for (const m of migracoes) {
    execFileSync(process.execPath, [path.join(UTILS, m)], {
        env: { ...process.env, DATABASE_PATH: BANCO },
        stdio: "ignore",
    });
}

const raw = new Database(BANCO);
raw.pragma("foreign_keys = OFF");
raw.exec("DELETE FROM shop_queue_sessions; DELETE FROM daily_closings; DELETE FROM transactions; DELETE FROM deliveries;");

const inserirCorrida = raw.prepare(`
    INSERT INTO deliveries (id, shopkeeper_id, motoboy_id, status, address, customer_name,
                            value, charge_mode, fee, daily_seq, picked_up_at, created_at, updated_at)
    VALUES (@id, @loja, @motoboy, @status, @endereco, @cliente,
            @valor, @cobranca, @taxa, @numero, @coletadaEm, @criadaEm, @criadaEm)
`);
function corrida(o) {
    inserirCorrida.run({
        loja: LOJA_A, motoboy: null, status: "pending", endereco: "Rua Teste, 100 - Centro",
        cliente: "Fulano", valor: 0, cobranca: "pago", taxa: 7, numero: null,
        coletadaEm: null, criadaEm: "2026-09-19T13:00:00.000Z", ...o,
    });
}

const { db } = await import("@/db");
const { shopQueueSessions } = await import("@/db/schema");
const { criarSessaoDaFila, carregarSessaoValida, limparNomeDoOperador } =
    await import("@/lib/queueSession");
const {
    COLUNAS_DA_FILA,
    CAMPOS_FINANCEIROS_FORA_DA_FILA,
    STATUS_ABERTOS_DA_FILA,
    STATUS_FILA_LABEL,
    carimboDaFila,
    podeCancelarNaFila,
    podeEditarNaFila,
} = await import("@/lib/fila-shared");
const { QUEUE_SESSION_TTL_MS, newQueueToken } = await import("@/lib/trackingToken");

test.after(() => {
    try { raw.close(); } catch { /* já fechado */ }
    try { fs.unlinkSync(BANCO); } catch { /* o Windows às vezes segura o arquivo */ }
});

/** Grava uma sessão com o prazo que o teste quiser (inclusive no passado). */
function sessaoComPrazo(loja, expiresAt, operador = null) {
    const token = newQueueToken();
    raw.prepare(`
        INSERT INTO shop_queue_sessions (token, shopkeeper_id, operator_name, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(token, loja, operador, expiresAt, new Date().toISOString());
    return token;
}

// =========================================================================
// (a) a sessão
// =========================================================================

test("a sessão nasce valendo, com o prazo de 12 horas", async () => {
    const antes = Date.now();
    const { token, expiresAt } = await criarSessaoDaFila(LOJA_A, "Maria");

    assert.ok(token.length >= 16, "o código precisa ser longo o bastante pra não se adivinhar");

    const prazo = new Date(expiresAt).getTime();
    const esperado = antes + QUEUE_SESSION_TTL_MS;
    // Folga de 1 minuto: o teste leva tempo entre uma linha e outra.
    assert.ok(Math.abs(prazo - esperado) < 60_000, `prazo fora das 12h: ${expiresAt}`);

    const sessao = await carregarSessaoValida(token);
    assert.ok(sessao, "a sessão recém-criada tinha que valer");
    assert.equal(sessao.shopkeeperId, LOJA_A);
    assert.equal(sessao.operatorName, "Maria");
});

test("código vencido não vale mais — nem por um segundo", async () => {
    const vencido = sessaoComPrazo(LOJA_A, new Date(Date.now() - 1000).toISOString());
    assert.equal(await carregarSessaoValida(vencido), null);
});

test("código inventado, vazio ou curto demais não vale (e nem consulta o banco)", async () => {
    assert.equal(await carregarSessaoValida("nao-existe-esse-codigo-aqui-nao"), null);
    assert.equal(await carregarSessaoValida(""), null);
    assert.equal(await carregarSessaoValida(null), null);
    assert.equal(await carregarSessaoValida(undefined), null);
    assert.equal(await carregarSessaoValida("curto"), null);
    assert.equal(await carregarSessaoValida(12345), null);
});

test("dois códigos diferentes nunca saem iguais", () => {
    const vistos = new Set(Array.from({ length: 200 }, () => newQueueToken()));
    assert.equal(vistos.size, 200);
});

test("criar sessão nova leva o lixo, mas não derruba o outro caixa", async () => {
    // Um PC com sessão vencida e outro com sessão boa.
    const vencida = sessaoComPrazo(LOJA_A, new Date(Date.now() - 60_000).toISOString());
    const outroPc = await criarSessaoDaFila(LOJA_A, "João");

    const nova = await criarSessaoDaFila(LOJA_A, "Maria");

    const sobrou = await db.query.shopQueueSessions.findFirst({
        where: (s, { eq }) => eq(s.token, vencida),
    });
    assert.equal(sobrou, undefined, "a sessão vencida tinha que ter sido apagada");

    assert.ok(await carregarSessaoValida(outroPc.token), "o outro PC do balcão não pode perder a fila");
    assert.ok(await carregarSessaoValida(nova.token));
});

test("nome do operador é aparado e limitado — e vazio vira 'sem nome'", () => {
    assert.equal(limparNomeDoOperador("  Maria  "), "Maria");
    assert.equal(limparNomeDoOperador(""), null);
    assert.equal(limparNomeDoOperador("   "), null);
    assert.equal(limparNomeDoOperador(null), null);
    assert.equal(limparNomeDoOperador(42), null);
    assert.equal(limparNomeDoOperador("x".repeat(500)).length, 80);
});

// =========================================================================
// (b) o escopo da loja
// =========================================================================

test("o código da loja A não enxerga corrida da loja B", async () => {
    corrida({ id: 900, loja: LOJA_A, status: "pending" });
    corrida({ id: 901, loja: LOJA_B, status: "pending" });

    const { token } = await criarSessaoDaFila(LOJA_A, null);
    const sessao = await carregarSessaoValida(token);

    // É exatamente assim que as telas e as ações buscam: o shopkeeper_id da
    // sessão entra no WHERE, não numa comparação depois.
    const daOutraLoja = await db.query.deliveries.findFirst({
        where: (d, { and, eq }) => and(eq(d.id, 901), eq(d.shopkeeperId, sessao.shopkeeperId)),
    });
    assert.equal(daOutraLoja, undefined, "corrida de outra loja não pode nem ser encontrada");

    const daPropria = await db.query.deliveries.findFirst({
        where: (d, { and, eq }) => and(eq(d.id, 900), eq(d.shopkeeperId, sessao.shopkeeperId)),
    });
    assert.ok(daPropria, "a corrida da própria loja tem que aparecer");
});

test("cancelar com o código da loja A não toca na corrida da loja B", async () => {
    corrida({ id: 910, loja: LOJA_B, status: "pending" });

    const { token } = await criarSessaoDaFila(LOJA_A, null);
    const { cancelarCorridaDaFilaAction } = await import("@/app/actions/queue");

    const fd = new FormData();
    fd.set("id", "910");
    fd.set("queueToken", token);
    const res = await cancelarCorridaDaFilaAction(fd);

    assert.ok("error" in res, "tinha que recusar");
    const depois = raw.prepare("SELECT status FROM deliveries WHERE id = 910").get();
    assert.equal(depois.status, "pending", "a corrida da outra loja foi alterada!");
});

test("ação com código vencido não muda nada", async () => {
    corrida({ id: 911, loja: LOJA_A, status: "pending" });

    const vencido = sessaoComPrazo(LOJA_A, new Date(Date.now() - 1000).toISOString());
    const { cancelarCorridaDaFilaAction } = await import("@/app/actions/queue");

    const fd = new FormData();
    fd.set("id", "911");
    fd.set("queueToken", vencido);
    const res = await cancelarCorridaDaFilaAction(fd);

    assert.ok("error" in res);
    const depois = raw.prepare("SELECT status FROM deliveries WHERE id = 911").get();
    assert.equal(depois.status, "pending");
});

test("cancelar a corrida da própria loja funciona e grava 'canceled' (com um L)", async () => {
    corrida({ id: 912, loja: LOJA_A, status: "pending" });

    const { token } = await criarSessaoDaFila(LOJA_A, "Maria");
    const { cancelarCorridaDaFilaAction } = await import("@/app/actions/queue");

    const fd = new FormData();
    fd.set("id", "912");
    fd.set("queueToken", token);
    const res = await cancelarCorridaDaFilaAction(fd);

    assert.deepEqual(res, { success: true });

    const depois = raw.prepare("SELECT status, receipt_note FROM deliveries WHERE id = 912").get();
    assert.equal(depois.status, "canceled", "o enum do banco é 'canceled', com UM L");
    assert.match(depois.receipt_note, /cancelada pela loja \(Maria\)/, "faltou o carimbo de quem cancelou");
});

test("corrida já coletada não é cancelada pela fila", async () => {
    corrida({
        id: 913, loja: LOJA_A, status: "picked_up", motoboy: null,
        coletadaEm: "2026-09-19T14:00:00.000Z",
    });

    const { token } = await criarSessaoDaFila(LOJA_A, null);
    const { cancelarCorridaDaFilaAction } = await import("@/app/actions/queue");

    const fd = new FormData();
    fd.set("id", "913");
    fd.set("queueToken", token);
    const res = await cancelarCorridaDaFilaAction(fd);

    assert.ok("error" in res);
    const depois = raw.prepare("SELECT status FROM deliveries WHERE id = 913").get();
    assert.equal(depois.status, "picked_up");
});

// =========================================================================
// (c) as regras puras de "pode editar / pode cancelar"
// =========================================================================

test("dá pra editar enquanto o pedido ainda está na loja", () => {
    assert.equal(podeEditarNaFila({ status: "pending" }), true);
    assert.equal(podeEditarNaFila({ status: "assigned" }), true, "motoboy vindo buscar ainda dá tempo");
});

test("depois que o motoboy coletou, ninguém edita mais", () => {
    assert.equal(podeEditarNaFila({ status: "picked_up" }), false);
    assert.equal(
        podeEditarNaFila({ status: "assigned", pickedUpAt: "2026-09-19T14:00:00.000Z" }),
        false,
        "o carimbo da coleta vale mesmo se o status não tiver acompanhado",
    );
});

test("entregue e cancelada não se editam nem se cancelam", () => {
    for (const status of ["delivered", "canceled"]) {
        assert.equal(podeEditarNaFila({ status }), false, status);
        assert.equal(podeCancelarNaFila({ status }), false, status);
    }
});

test("rascunho cancela, mas não 'edita' (ele tem a tela de conferência)", () => {
    assert.equal(podeCancelarNaFila({ status: "draft" }), true);
    assert.equal(podeEditarNaFila({ status: "draft" }), false);
});

test("cancelar vale na mesma janela da edição, mais o rascunho", () => {
    assert.equal(podeCancelarNaFila({ status: "pending" }), true);
    assert.equal(podeCancelarNaFila({ status: "assigned" }), true);
    assert.equal(podeCancelarNaFila({ status: "picked_up" }), false);
});

test("o carimbo só aparece quando se sabe quem estava no caixa", () => {
    assert.equal(carimboDaFila("portão azul", "lançada", "Maria"), "portão azul · lançada pela loja (Maria)");
    assert.equal(carimboDaFila(null, "cancelada", "João"), "cancelada pela loja (João)");
    assert.equal(carimboDaFila("portão azul", "lançada", null), "portão azul", "sem nome, nada de carimbo vazio");
    assert.equal(carimboDaFila(null, "lançada", "   "), null);
    assert.equal(carimboDaFila("x".repeat(2000), "lançada", "Maria").length, 1000, "o texto é cortado");
});

test("o status aparece em português pro vendedor — nada de 'assigned' na tela", () => {
    for (const status of ["draft", ...STATUS_ABERTOS_DA_FILA, "delivered", "canceled"]) {
        const rotulo = STATUS_FILA_LABEL[status];
        assert.ok(rotulo, `faltou o texto de "${status}"`);
        assert.notEqual(rotulo, status, `"${status}" ficou cru na tela`);
    }
});

// =========================================================================
// (d) nada de financeiro
// =========================================================================

test("a lista da fila não carrega NENHUM campo de dinheiro da operação", () => {
    const carregados = Object.keys(COLUNAS_DA_FILA);
    const proibidos = carregados.filter((c) => CAMPOS_FINANCEIROS_FORA_DA_FILA.includes(c));

    assert.deepEqual(
        proibidos,
        [],
        `A fila é a tela do VENDEDOR: taxa do motoboy, recibo e carteira não podem sair daqui.\n` +
        `Campo(s) proibido(s) na lista: ${proibidos.join(", ")}.\n` +
        `Se precisar mesmo, discuta antes — não é só tirar da lista.`
    );

    // O valor que o CLIENTE paga fica, e é justamente o que o vendedor confere.
    assert.equal(COLUNAS_DA_FILA.value, true, "o valor a receber do cliente tem que aparecer");
    assert.equal(COLUNAS_DA_FILA.chargeMode, true, "o modo de cobrança tem que aparecer");
    assert.equal("fee" in COLUNAS_DA_FILA, false, "a taxa do motoboy não é assunto do balcão");
});

test("conferir pela fila não zera a taxa que a regra da loja calculou", async () => {
    // Era o risco de esconder o campo "Taxa" da tela: o formulário mandaria o
    // campo vazio e a conferência gravaria 0, tirando o ganho do motoboy.
    corrida({
        id: 920, loja: LOJA_A, status: "draft", taxa: 9.5,
        endereco: "Rua da Taxa, 1 - Centro",
    });
    raw.prepare("UPDATE deliveries SET lat = -19.75, lng = -47.93, geo_precision = 'exata' WHERE id = 920").run();

    const { token } = await criarSessaoDaFila(LOJA_A, "Maria");
    const { conferirRascunhoDaFilaAction } = await import("@/app/actions/queue");

    const fd = new FormData();
    fd.set("id", "920");
    fd.set("queueToken", token);
    fd.set("address", "Rua da Taxa, 1 - Centro");
    fd.set("chargeMode", "pago");
    // O formulário da fila manda a taxa num campo ESCONDIDO, com o valor atual.
    fd.set("fee", "9,50");
    fd.set("lat", "-19.75");
    fd.set("lng", "-47.93");
    fd.set("pinTouched", "1");

    const res = await conferirRascunhoDaFilaAction(fd);
    assert.deepEqual(res, { success: true }, JSON.stringify(res));

    const depois = raw.prepare("SELECT status, fee, daily_seq FROM deliveries WHERE id = 920").get();
    assert.equal(depois.status, "pending", "o rascunho tinha que virar corrida na fila");
    assert.equal(depois.fee, 9.5, "a taxa do motoboy foi perdida na conferência pela fila");
    assert.ok(depois.daily_seq > 0, "a corrida liberada tem que ganhar o 'Corrida N' do dia");
});
