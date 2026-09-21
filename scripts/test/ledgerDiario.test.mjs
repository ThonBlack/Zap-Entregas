/**
 * Testes do controle diário da carteira (src/lib/ledgerDiario.ts e o
 * -shared.ts, que é puro).
 *
 * O que está sendo protegido é a pergunta do dono da loja: "em que dias ele
 * devolveu o dinheiro e em que dias não devolveu?". Se o agrupamento por dia,
 * o fuso ou o saldo corrido saírem errados, a resposta sai errada.
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/ledgerDiario.test.mjs
 *
 * Usa um banco DESCARTÁVEL (cópia do sqlite.db local numa pasta temporária) —
 * nada aqui encosta no banco de desenvolvimento nem no de produção.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const RAIZ = path.resolve(fileURLToPath(import.meta.url), "../../..");
const BANCO = path.join(os.tmpdir(), `zap-ledger-diario-${process.pid}.db`);

const LOJA = 2;
const MOTOBOY = 3;
const OUTRA_LOJA = 1;

// --- monta o banco de teste ANTES de importar o código (o @/db lê a env no load)
fs.copyFileSync(path.join(RAIZ, "sqlite.db"), BANCO);
process.env.DATABASE_PATH = BANCO;

// O sqlite.db local pode estar atrás do código: roda as migrações leves na
// cópia (as mesmas do CMD do Dockerfile), pra o teste não depender do estado
// do banco de quem está rodando.
const { execFileSync } = await import("node:child_process");
const migracoes = fs
    .readdirSync(path.join(RAIZ, "scripts", "utils"))
    .filter((f) => /^add_.*\.js$/.test(f) || f === "make_phone_nullable.js")
    .sort();
for (const m of migracoes) {
    execFileSync(process.execPath, [path.join(RAIZ, "scripts", "utils", m)], {
        env: { ...process.env, DATABASE_PATH: BANCO },
        stdio: "ignore",
    });
}

const raw = new Database(BANCO);
raw.pragma("foreign_keys = OFF");
raw.exec("DELETE FROM daily_closings; DELETE FROM transactions; DELETE FROM deliveries;");

const inserirCorrida = raw.prepare(`
    INSERT INTO deliveries (id, shopkeeper_id, motoboy_id, status, address, fee, delivered_at)
    VALUES (@id, @loja, @motoboy, 'delivered', 'Rua Teste, 100', @taxa, @entregueEm)
`);
const inserirLancamento = raw.prepare(`
    INSERT INTO transactions (user_id, amount, type, kind, status, description, related_delivery_id, created_at)
    VALUES (@usuario, @valor, @tipo, @natureza, @situacao, @descricao, @corrida, @criadoEm)
`);

function lancar(o) {
    inserirLancamento.run({
        usuario: MOTOBOY, situacao: "confirmed", descricao: null, corrida: null, ...o,
    });
}
/** Uma corrida completa: crédito da taxa + débito do dinheiro que ficou com ele. */
function corridaComDinheiro({ id, taxa, dinheiro, quando, loja = LOJA }) {
    inserirCorrida.run({ id, loja, motoboy: MOTOBOY, taxa, entregueEm: quando });
    lancar({ valor: taxa, tipo: "credit", natureza: "corrida", corrida: id, criadoEm: quando, descricao: `Corrida ${id}` });
    if (dinheiro > 0) {
        lancar({ valor: dinheiro, tipo: "debit", natureza: "dinheiro", corrida: id, criadoEm: quando, descricao: "Recebido em dinheiro" });
    }
}

// ─── Semana de 14/09 (segunda) a 20/09 (domingo) ────────────────────────────
// Saldo inicial da conta: a loja devia R$ 20 a ele antes de tudo.
lancar({ valor: 20, tipo: "credit", natureza: "abertura", criadoEm: "2026-09-10T12:00:00.000Z", descricao: "Saldo inicial" });

// Segunda 14/09: 2 corridas, R$ 100 de dinheiro na mão dele, devolveu tudo.
corridaComDinheiro({ id: 501, taxa: 10, dinheiro: 60, quando: "2026-09-14T15:00:00.000Z" });
corridaComDinheiro({ id: 502, taxa: 12, dinheiro: 40, quando: "2026-09-14T18:00:00.000Z" });
lancar({ valor: 100, tipo: "credit", natureza: "pagamento", criadoEm: "2026-09-14T22:00:00.000Z", descricao: "Motoboy me entregou dinheiro" });

// Terça 15/09: 1 corrida, R$ 80 com ele, devolveu só R$ 30 (parte).
corridaComDinheiro({ id: 503, taxa: 9, dinheiro: 80, quando: "2026-09-15T16:00:00.000Z" });
lancar({ valor: 30, tipo: "credit", natureza: "pagamento", criadoEm: "2026-09-15T21:00:00.000Z", descricao: "Parte do dinheiro" });

// Quarta 16/09: 1 corrida, R$ 50 com ele, NÃO devolveu nada nesse dia.
corridaComDinheiro({ id: 504, taxa: 8, dinheiro: 50, quando: "2026-09-16T17:00:00.000Z" });

// Quinta 17/09: nenhuma corrida, mas devolveu R$ 70 (cobrindo terça e quarta).
lancar({ valor: 70, tipo: "credit", natureza: "pagamento", criadoEm: "2026-09-17T14:00:00.000Z", descricao: "Acerto dos outros dias" });

// Sexta 18/09: só a loja pagando o motoboy e um bônus.
lancar({ valor: 25, tipo: "debit", natureza: "pagamento", criadoEm: "2026-09-18T13:00:00.000Z", descricao: "Paguei o motoboy" });
lancar({ valor: 5, tipo: "credit", natureza: "ajuste", criadoEm: "2026-09-18T13:30:00.000Z", descricao: "Gasolina" });

// ─── Virada de dia em Brasília ──────────────────────────────────────────────
// Domingo 20/09 às 23h30 de Brasília = 21/09 02:30 em UTC.
corridaComDinheiro({ id: 505, taxa: 7, dinheiro: 0, quando: "2026-09-21T02:30:00.000Z" });
// Segunda 21/09 às 00h30 de Brasília = 21/09 03:30 em UTC — já é outra semana.
corridaComDinheiro({ id: 506, taxa: 6, dinheiro: 0, quando: "2026-09-21T03:30:00.000Z" });

// ─── Ruídos que NÃO podem entrar ────────────────────────────────────────────
// Lançamento esperando o motoboy aceitar: não é dinheiro ainda.
lancar({ valor: 999, tipo: "credit", natureza: "pagamento", situacao: "pending", criadoEm: "2026-09-16T12:00:00.000Z", descricao: "Aguardando" });
lancar({ valor: 888, tipo: "debit", natureza: "pagamento", situacao: "rejected", criadoEm: "2026-09-16T12:10:00.000Z", descricao: "Recusado" });
// Corrida de OUTRA loja (o motoboy "da casa" roda pras duas).
corridaComDinheiro({ id: 601, taxa: 30, dinheiro: 200, quando: "2026-09-16T19:00:00.000Z", loja: OUTRA_LOJA });
// Outro motoboy no mesmo dia.
lancar({ usuario: 1, valor: 777, tipo: "credit", natureza: "corrida", criadoEm: "2026-09-16T19:30:00.000Z" });

raw.close();

const {
    getLedgerPorDia,
    getDevolucoesNoPeriodo,
    agruparEmSemanas,
    agruparEmMeses,
    classificarDevolucao,
    faltaDevolver,
    devolveuAMais,
    totaisDosDias,
} = await import("@/lib/ledgerDiario");

test.after(() => {
    try { fs.unlinkSync(BANCO); } catch { /* o Windows às vezes segura o arquivo; não é problema */ }
});

const dePara = (l) => Object.fromEntries(l.dias.map((d) => [d.dia, d]));

// =========================================================================
// Agregação por dia
// =========================================================================

test("cada dia soma ganho, dinheiro na mão dele, devolução e pagamento", async () => {
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-14", "2026-09-20");
    const dias = dePara(l);

    assert.equal(dias["2026-09-14"].corridas, 2);
    assert.equal(dias["2026-09-14"].ganho, 22);
    assert.equal(dias["2026-09-14"].dinheiroComEle, 100);
    assert.equal(dias["2026-09-14"].devolveu, 100);
    assert.equal(dias["2026-09-14"].variacao, 22, "+22 de taxa −100 de dinheiro +100 devolvidos");

    assert.equal(dias["2026-09-18"].corridas, 0, "sexta não teve corrida");
    assert.equal(dias["2026-09-18"].lojaPagou, 25);
    assert.equal(dias["2026-09-18"].ajustes, 5);
    assert.equal(dias["2026-09-18"].variacao, -20);
});

test("dia só de devolução aparece na lista (e é o caso do 'R$ 140 esses dias')", async () => {
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-14", "2026-09-20");
    const quinta = dePara(l)["2026-09-17"];
    assert.ok(quinta, "quinta não teve corrida nenhuma, mas teve devolução");
    assert.equal(quinta.corridas, 0);
    assert.equal(quinta.devolveu, 70);
    assert.equal(quinta.variacao, 70);
});

test("dia sem movimento nenhum não vira linha", async () => {
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-14", "2026-09-20");
    assert.equal(dePara(l)["2026-09-19"], undefined, "sábado não teve nada");
    assert.deepEqual(
        l.dias.map((d) => d.dia),
        ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-20"],
    );
});

test("pendente e recusado ficam de fora: só o que está confirmado é dinheiro", async () => {
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-16", "2026-09-16");
    const quarta = l.dias[0];
    assert.equal(quarta.devolveu, 0, "os R$ 999 ainda esperam o motoboy aceitar");
    assert.equal(quarta.lojaPagou, 0, "os R$ 888 foram recusados");
});

test("a carteira de outro motoboy não entra", async () => {
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-16", "2026-09-16");
    // 8 (corrida 504) + 30 (corrida 601, de outra loja mas do MESMO motoboy);
    // os R$ 777 do usuário 1 são de outra carteira e não podem aparecer.
    assert.equal(l.dias[0].ganho, 38);
    assert.equal(l.dias[0].ganho < 777, true);
});

// =========================================================================
// Virada de dia em Brasília
// =========================================================================

test("23h30 e 00h30 de Brasília caem em dias diferentes, não no dia de UTC", async () => {
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-20", "2026-09-21");
    const dias = dePara(l);
    // As duas corridas foram gravadas no MESMO dia em UTC (21/09).
    assert.equal(dias["2026-09-20"].ganho, 7, "02:30Z é 23:30 de domingo em Brasília");
    assert.equal(dias["2026-09-21"].ganho, 6, "03:30Z já é 00:30 de segunda em Brasília");
});

// =========================================================================
// Saldo: inicial, corrido e final
// =========================================================================

test("o saldo de abertura é tudo que foi confirmado ANTES do primeiro dia", async () => {
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-14", "2026-09-20");
    assert.equal(l.saldoInicial, 20, "o saldo inicial de 10/09");
});

test("o saldo no fim de cada dia é o anterior mais a variação", async () => {
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-14", "2026-09-20");
    let esperado = l.saldoInicial;
    for (const d of l.dias) {
        esperado = Math.round((esperado + d.variacao) * 100) / 100;
        assert.equal(d.saldoNoFim, esperado, `saldo do dia ${d.dia}`);
    }
    assert.equal(l.saldoFinal, l.dias[l.dias.length - 1].saldoNoFim);
});

test("o saldo final bate com a régua da carteira (Σcredit − Σdebit)", async () => {
    const { getBalance } = await import("@/lib/wallet");
    // Até 21/09 já está tudo lançado, então o final do período é o saldo de hoje.
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-01", "2026-09-30");
    assert.equal(l.saldoFinal, await getBalance(MOTOBOY));
    assert.equal(l.saldoAtual, await getBalance(MOTOBOY));
});

test("pedir um pedaço do meio não muda o saldo: a abertura já traz o passado", async () => {
    const inteiro = await getLedgerPorDia(MOTOBOY, "2026-09-01", "2026-09-30");
    const pedaco = await getLedgerPorDia(MOTOBOY, "2026-09-17", "2026-09-30");
    const dias = dePara(inteiro);
    assert.equal(pedaco.saldoInicial, dias["2026-09-16"].saldoNoFim);
    assert.equal(pedaco.saldoFinal, inteiro.saldoFinal);
});

// =========================================================================
// Recorte por loja (motoboy "da casa" que roda pra mais de uma)
// =========================================================================

test("sem recorte de loja, a corrida da outra loja entra", async () => {
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-16", "2026-09-16");
    assert.equal(l.dias[0].ganho, 38, "8 desta loja + 30 da outra");
    assert.equal(l.dias[0].dinheiroComEle, 250, "50 + 200");
});

test("com recorte de loja, só as corridas dela — o lançamento manual entra sempre", async () => {
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-16", "2026-09-18", { shopkeeperId: LOJA });
    const dias = dePara(l);
    assert.equal(dias["2026-09-16"].ganho, 8);
    assert.equal(dias["2026-09-16"].dinheiroComEle, 50);
    assert.equal(dias["2026-09-18"].lojaPagou, 25, "pagamento não tem loja: conta sempre");
});

// =========================================================================
// Devoluções listadas
// =========================================================================

test("a lista de devoluções traz só credit/pagamento, da mais nova pra mais velha", async () => {
    const linhas = await getDevolucoesNoPeriodo(MOTOBOY, "2026-09-14", "2026-09-20");
    assert.deepEqual(linhas.map((l) => l.amount), [70, 30, 100]);
    assert.equal(linhas[0].description, "Acerto dos outros dias");
    // O "Paguei o motoboy" (debit) e o pendente de R$ 999 não podem aparecer.
    assert.equal(linhas.some((l) => l.amount === 25 || l.amount === 999), false);
});

// =========================================================================
// Parte pura: selo do dia, falta devolver, semanas e meses
// =========================================================================

test("o selo do dia responde 'devolveu ou não?'", () => {
    assert.equal(classificarDevolucao({ dinheiroComEle: 0, devolveu: 0 }), "nada_a_devolver");
    assert.equal(classificarDevolucao({ dinheiroComEle: 0, devolveu: 50 }), "nada_a_devolver", "devolveu de outro dia");
    assert.equal(classificarDevolucao({ dinheiroComEle: 100, devolveu: 100 }), "devolveu");
    assert.equal(classificarDevolucao({ dinheiroComEle: 100, devolveu: 140 }), "devolveu", "de sobra ainda é devolveu");
    assert.equal(classificarDevolucao({ dinheiroComEle: 100, devolveu: 30 }), "devolveu_parte");
    assert.equal(classificarDevolucao({ dinheiroComEle: 100, devolveu: 0 }), "nao_devolveu");
    // Centavo de ponto flutuante não pode virar "devolveu parte".
    assert.equal(classificarDevolucao({ dinheiroComEle: 150, devolveu: 149.999 }), "devolveu");
});

test("'falta devolver' nunca é negativo — a sobra tem nome próprio", () => {
    assert.equal(faltaDevolver({ dinheiroComEle: 230, devolveu: 200 }), 30);
    assert.equal(faltaDevolver({ dinheiroComEle: 100, devolveu: 140 }), 0);
    assert.equal(devolveuAMais({ dinheiroComEle: 100, devolveu: 140 }), 40);
    assert.equal(devolveuAMais({ dinheiroComEle: 230, devolveu: 200 }), 0);
});

test("no período, o que vale é 'dinheiro com ele − devolvido', não o selo do dia", async () => {
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-14", "2026-09-20", { shopkeeperId: LOJA });
    const totais = totaisDosDias(l.dias);
    assert.equal(totais.dinheiroComEle, 230, "100 + 80 + 50");
    assert.equal(totais.devolveu, 200, "100 + 30 + 70");
    assert.equal(faltaDevolver(totais), 30);
    // Quarta tem selo "não devolveu", mas quinta já cobriu quase tudo.
    const quarta = dePara(l)["2026-09-16"];
    assert.equal(classificarDevolucao(quarta), "nao_devolveu");
});

test("semanas vão de segunda a domingo e emendam o saldo de uma na outra", async () => {
    const l = await getLedgerPorDia(MOTOBOY, "2026-09-01", "2026-09-30", { shopkeeperId: LOJA });
    const semanas = agruparEmSemanas(l.dias, l.saldoInicial);

    const cheia = semanas.find((s) => s.chave === "2026-09-14");
    assert.equal(cheia.rotulo, "14/09 a 20/09");
    assert.equal(cheia.fim, "2026-09-20");
    assert.equal(cheia.dias.length, 6, "de segunda a domingo, sem o sábado vazio");
    assert.equal(cheia.totais.ganho, 46, "22 + 9 + 8 + 7");

    const seguinte = semanas.find((s) => s.chave === "2026-09-21");
    assert.equal(seguinte.saldoInicial, cheia.saldoFinal, "o saldo passa de uma semana pra outra");
    assert.equal(seguinte.saldoFinal, l.saldoFinal);
    // A soma das semanas é a soma dos dias — nenhum dia se perde no caminho.
    const somaDasSemanas = semanas.reduce((n, s) => n + s.totais.ganho, 0);
    assert.equal(somaDasSemanas, totaisDosDias(l.dias).ganho);
});

test("a semana que atravessa o mês não é cortada em duas", () => {
    // 28/09 é segunda; 01/10 é quinta — tudo na mesma semana.
    const dias = [
        { dia: "2026-09-28", corridas: 1, ganho: 10, dinheiroComEle: 0, devolveu: 0, lojaPagou: 0, ajustes: 0, variacao: 10, saldoNoFim: 10 },
        { dia: "2026-10-01", corridas: 1, ganho: 5, dinheiroComEle: 0, devolveu: 0, lojaPagou: 0, ajustes: 0, variacao: 5, saldoNoFim: 15 },
    ];
    const semanas = agruparEmSemanas(dias, 0);
    assert.equal(semanas.length, 1, "uma semana só, apesar da virada de mês");
    assert.equal(semanas[0].rotulo, "28/09 a 04/10");
    assert.equal(semanas[0].saldoInicial, 0);
    assert.equal(semanas[0].saldoFinal, 15);

    // Já em MESES, os mesmos dois dias são dois períodos.
    const meses = agruparEmMeses(dias, 0);
    assert.deepEqual(meses.map((m) => m.chave), ["2026-09", "2026-10"]);
    assert.equal(meses[0].rotulo, "setembro/2026");
    assert.equal(meses[0].fim, "2026-09-30", "setembro tem 30 dias");
    assert.equal(meses[1].saldoInicial, 10, "o mês seguinte começa onde o outro parou");
    assert.equal(meses[1].saldoFinal, 15);
});

test("agrupar lista vazia não estoura", () => {
    assert.deepEqual(agruparEmSemanas([], 42), []);
    assert.deepEqual(agruparEmMeses([], 42), []);
    assert.equal(totaisDosDias([]).ganho, 0);
});
