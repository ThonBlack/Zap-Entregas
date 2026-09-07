/**
 * Testes da régua do "Resumo do dia" (src/lib/dailySummary.ts).
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/dailySummary.test.mjs
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
const BANCO = path.join(os.tmpdir(), `zap-resumo-do-dia-${process.pid}.db`);

const LOJA = 2;
const MOTOBOY = 3;
const OUTRA_LOJA = 1;

// --- monta o banco de teste ANTES de importar o código (o @/db lê a env no load)
fs.copyFileSync(path.join(RAIZ, "sqlite.db"), BANCO);
process.env.DATABASE_PATH = BANCO;

const raw = new Database(BANCO);
raw.pragma("foreign_keys = OFF");
raw.exec("DELETE FROM daily_closings; DELETE FROM transactions; DELETE FROM deliveries;");

const inserirCorrida = raw.prepare(`
    INSERT INTO deliveries (id, shopkeeper_id, motoboy_id, status, customer_name, address, fee,
                            receipt_status, received_amount, received_method, delivered_at)
    VALUES (@id, @loja, @motoboy, 'delivered', @cliente, @endereco, @taxa,
            @recibo, @valor, @metodo, @entregueEm)
`);
const inserirLancamento = raw.prepare(`
    INSERT INTO transactions (user_id, amount, type, kind, status, description, created_at)
    VALUES (@usuario, @valor, @tipo, @natureza, 'confirmed', @descricao, @criadoEm)
`);

function corrida(o) {
    inserirCorrida.run({
        cliente: "Cliente", endereco: "Rua Teste, 100 - Centro",
        recibo: null, valor: null, metodo: null,
        loja: LOJA, motoboy: MOTOBOY, ...o,
    });
}

// --- 02/09: quatro corridas, uma de cada jeito de pagar
corrida({ id: 101, taxa: 10, recibo: "recebido", valor: 150, metodo: "dinheiro", entregueEm: "2026-09-02T14:00:00.000Z", cliente: "Ana" });
corrida({ id: 102, taxa: 12, recibo: "recebido", valor: 80, metodo: "pix", entregueEm: "2026-09-02T15:00:00.000Z", cliente: "Bruno" });
corrida({ id: 103, taxa: 8, recibo: "valor_diferente", valor: 60, metodo: "cartao", entregueEm: "2026-09-02T16:00:00.000Z", cliente: "Carla" });
corrida({ id: 104, taxa: 9.5, recibo: "nao_recebido", valor: 0, metodo: null, entregueEm: "2026-09-02T17:00:00.000Z", cliente: "Davi" });
// corrida de OUTRA loja no mesmo dia — não pode entrar no fechamento desta loja
corrida({ id: 105, loja: OUTRA_LOJA, taxa: 99, recibo: "recebido", valor: 500, metodo: "dinheiro", entregueEm: "2026-09-02T18:00:00.000Z", cliente: "Intruso" });

// --- virada de dia: 02:30Z = 23:30 de 03/09 em Brasília
corrida({ id: 201, taxa: 7, recibo: "recebido", valor: 40, metodo: "dinheiro", entregueEm: "2026-09-04T02:30:00.000Z", cliente: "Noturno" });
// e uma logo depois da meia-noite de Brasília, já no dia 04
corrida({ id: 202, taxa: 6, recibo: "nada_a_receber", valor: 0, metodo: null, entregueEm: "2026-09-04T03:30:00.000Z", cliente: "Madrugada" });

// --- data no formato antigo do CURRENT_TIMESTAMP (sem "Z"), tem que valer igual
corrida({ id: 301, taxa: 15, recibo: "recebido", valor: 100, metodo: "dinheiro", entregueEm: "2026-09-05 20:00:00", cliente: "Formato Velho" });

// --- ajustes manuais do dia 02/09
inserirLancamento.run({ usuario: MOTOBOY, valor: 25, tipo: "credit", natureza: "ajuste", descricao: "Gasolina", criadoEm: "2026-09-02T18:00:00.000Z" });
inserirLancamento.run({ usuario: MOTOBOY, valor: 10, tipo: "debit", natureza: "ajuste", descricao: "Cobrar do motoboy", criadoEm: "2026-09-02 19:00:00" });
// pagamento não é ajuste: não pode entrar em adjustmentsTotal
inserirLancamento.run({ usuario: MOTOBOY, valor: 500, tipo: "debit", natureza: "pagamento", descricao: "Acerto", criadoEm: "2026-09-02T20:00:00.000Z" });

raw.close();

const { getDailySummary, getMotoboysComCorridasNoDia } = await import("@/lib/dailySummary");

test.after(() => {
    try { fs.unlinkSync(BANCO); } catch { /* o Windows às vezes segura o arquivo; não é problema */ }
});

test("dia sem corrida devolve tudo zerado", async () => {
    const r = await getDailySummary(MOTOBOY, LOJA, "2026-09-01");
    assert.equal(r.deliveriesCount, 0);
    assert.equal(r.feesTotal, 0);
    assert.equal(r.cashTotal, 0);
    assert.equal(r.pixTotal, 0);
    assert.equal(r.cardTotal, 0);
    assert.equal(r.net, 0);
    assert.deepEqual(r.lines, []);
});

test("separa dinheiro, PIX, cartão e não recebido", async () => {
    const r = await getDailySummary(MOTOBOY, LOJA, "2026-09-02");
    assert.equal(r.deliveriesCount, 4, "a corrida da outra loja não entra");
    assert.equal(r.feesTotal, 39.5);
    assert.equal(r.cashTotal, 150, "só espécie conta como dinheiro na mão dele");
    assert.equal(r.pixTotal, 80);
    assert.equal(r.cardTotal, 60);
    // líquido = taxas − dinheiro em espécie: ele está com R$ 110,50 da loja
    assert.equal(r.net, -110.5);
    assert.deepEqual(r.lines.map(l => l.id), [101, 102, 103, 104], "em ordem de entrega");
});

test("não recebido não vira dinheiro em nenhum método", async () => {
    const r = await getDailySummary(MOTOBOY, LOJA, "2026-09-02");
    const naoRecebida = r.lines.find(l => l.id === 104);
    assert.equal(naoRecebida.receiptStatus, "nao_recebido");
    assert.equal(r.cashTotal + r.pixTotal + r.cardTotal, 290, "150 + 80 + 60, sem a não recebida");
});

test("ajuste manual do dia entra separado; pagamento não entra", async () => {
    const r = await getDailySummary(MOTOBOY, LOJA, "2026-09-02");
    assert.equal(r.adjustmentsTotal, 15, "+25 de gasolina −10 de cobrança");
    assert.equal(r.net, -110.5, "ajuste não mexe no líquido do dia");
});

test("corrida das 23h30 fica no dia de Brasília, não no dia UTC", async () => {
    const dia3 = await getDailySummary(MOTOBOY, LOJA, "2026-09-03");
    assert.equal(dia3.deliveriesCount, 1, "02:30Z é 23:30 do dia 03 em Brasília");
    assert.equal(dia3.lines[0].id, 201);
    assert.equal(dia3.feesTotal, 7);
    assert.equal(dia3.cashTotal, 40);
    assert.equal(dia3.net, -33);

    const dia4 = await getDailySummary(MOTOBOY, LOJA, "2026-09-04");
    assert.equal(dia4.deliveriesCount, 1, "só a corrida das 00h30 de Brasília");
    assert.equal(dia4.lines[0].id, 202);
    assert.equal(dia4.net, 6, "sem dinheiro em espécie, a loja deve a taxa");
});

test("aceita a data no formato antigo do banco (sem Z)", async () => {
    const r = await getDailySummary(MOTOBOY, LOJA, "2026-09-05");
    assert.equal(r.deliveriesCount, 1);
    assert.equal(r.feesTotal, 15);
    assert.equal(r.cashTotal, 100);
    assert.equal(r.net, -85);
});

test("sem filtro de loja (motoboy da casa) a corrida da outra loja aparece", async () => {
    const r = await getDailySummary(MOTOBOY, null, "2026-09-02");
    assert.equal(r.deliveriesCount, 5);
    assert.equal(r.cashTotal, 650, "150 + 500 da outra loja");
});

test("lista de quem rodou no dia respeita a loja", async () => {
    const daLoja = await getMotoboysComCorridasNoDia(LOJA, "2026-09-02");
    assert.deepEqual(daLoja, [{ motoboyId: MOTOBOY, corridas: 4 }]);

    const vazio = await getMotoboysComCorridasNoDia(LOJA, "2026-09-01");
    assert.deepEqual(vazio, []);
});
