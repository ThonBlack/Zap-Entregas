/**
 * Testes do fechamento da corrida no banco (src/lib/deliveryLedger.ts) —
 * a parte que mexe com o dinheiro do motoboy.
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/deliveryLedger.test.mjs
 *
 * Banco DESCARTÁVEL (cópia do sqlite.db local numa pasta temporária).
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
const BANCO = path.join(os.tmpdir(), `zap-ledger-${process.pid}.db`);

const LOJA = 2;
const MOTOBOY = 3;

fs.copyFileSync(path.join(RAIZ, "sqlite.db"), BANCO);
process.env.DATABASE_PATH = BANCO;

// Migrações leves na cópia (as mesmas que rodam no start do container).
const migracoes = fs
    .readdirSync(path.join(RAIZ, "scripts", "utils"))
    .filter((f) => /^add_.*\.js$/.test(f) || f === "make_phone_nullable.js" || f === "normalize_timestamps.js")
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

const novaCorrida = raw.prepare(`
    INSERT INTO deliveries (id, shopkeeper_id, motoboy_id, status, customer_name, address, fee, value, created_at, updated_at)
    VALUES (@id, @loja, @motoboy, @status, @cliente, @endereco, @taxa, 0, @criadaEm, @criadaEm)
`);

function corrida(o) {
    novaCorrida.run({
        loja: LOJA, motoboy: MOTOBOY, status: "assigned", cliente: "Cliente",
        endereco: "Rua Teste, 100", taxa: 0, criadaEm: "2026-09-06T12:00:00.000Z",
        ...o,
    });
}

corrida({ id: 501 });                       // fechamento simples
corrida({ id: 502 });                       // duas chamadas seguidas
corrida({ id: 503 });                       // com dinheiro do cliente
corrida({ id: 504, motoboy: null });        // sem motoboy: não mexe em carteira
corrida({ id: 505, status: "delivered" });  // já entregue
corrida({ id: 506 });                       // "a conferir": Pix da loja confirmado
corrida({ id: 507 });                       // "a conferir": cliente pagou em dinheiro na porta
corrida({ id: 508, motoboy: null, status: "pending" }); // a LOJA finaliza e escolhe quem entregou

const ABERTOS = ["pending", "assigned", "picked_up"];
const SEM_RECIBO = { receiptStatus: null, receivedAmount: null, receivedMethod: null, receiptNote: null };

const base = (id, extra = {}) => ({
    deliveryId: id,
    motoboyId: MOTOBOY,
    shopkeeperId: LOJA,
    customerName: "Cliente",
    fee: 10,
    recibo: SEM_RECIBO,
    statusAbertos: ABERTOS,
    ...extra,
});

const { fecharCorridaNoBanco } = await import("@/lib/deliveryLedger");

const conta = raw.prepare(
    "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM transactions WHERE related_delivery_id = ? AND type = ?"
);

test.after(() => {
    try { raw.close(); } catch { /* já fechado */ }
    try { fs.unlinkSync(BANCO); } catch { /* o Windows às vezes segura o arquivo */ }
});

test("fechar a corrida marca entregue e credita a taxa uma vez", () => {
    const r = fecharCorridaNoBanco(base(501));
    assert.equal(r.ok, true);
    assert.equal(r.jaEntregue, false);
    assert.equal(r.creditoLancado, true);

    const linha = raw.prepare("SELECT status, fee, delivered_at FROM deliveries WHERE id = 501").get();
    assert.equal(linha.status, "delivered");
    assert.equal(linha.fee, 10);
    assert.ok(linha.delivered_at, "delivered_at preenchido");

    const credito = conta.get(501, "credit");
    assert.equal(credito.n, 1);
    assert.equal(credito.total, 10);
});

test("duas finalizações da MESMA corrida creditam uma vez só", () => {
    const primeira = fecharCorridaNoBanco(base(502, { fee: 8 }));
    const segunda = fecharCorridaNoBanco(base(502, { fee: 8 }));

    assert.equal(primeira.ok, true);
    assert.equal(primeira.creditoLancado, true);
    assert.equal(segunda.ok, true);
    assert.equal(segunda.jaEntregue, true, "a segunda vê que já está entregue");

    const credito = conta.get(502, "credit");
    assert.equal(credito.n, 1, "uma linha só de crédito");
    assert.equal(credito.total, 8, "a loja deve R$ 8,00, não R$ 16,00");
});

test("o banco barra o crédito repetido mesmo por fora do código", () => {
    // Simula a corrida entre dois processos: o índice único é a tranca de verdade.
    const inserir = raw.prepare(`
        INSERT INTO transactions (user_id, amount, type, kind, status, description, related_delivery_id, created_at)
        VALUES (?, ?, 'credit', 'corrida', 'confirmed', 'Corrida #502 (repetida)', 502, '2026-09-06T13:00:00.000Z')
    `);
    assert.throws(
        () => inserir.run(MOTOBOY, 8),
        /UNIQUE constraint failed/i,
        "índice único (related_delivery_id, type) tem que barrar"
    );
    assert.equal(conta.get(502, "credit").n, 1);
});

test("dinheiro em espécie vira débito; PIX não", () => {
    const r = fecharCorridaNoBanco(base(503, {
        fee: 6,
        recibo: {
            receiptStatus: "recebido", receivedAmount: 150,
            receivedMethod: "dinheiro", receiptNote: null,
        },
    }));
    assert.equal(r.ok, true);
    assert.equal(r.debitoLancado, true);

    const debito = conta.get(503, "debit");
    assert.equal(debito.n, 1);
    assert.equal(debito.total, 150);
    assert.equal(conta.get(503, "credit").total, 6);
});

test("corrida sem motoboy fecha sem lançar nada na carteira", () => {
    const r = fecharCorridaNoBanco(base(504, { motoboyId: null, fee: 12 }));
    assert.equal(r.ok, true);
    assert.equal(r.creditoLancado, false);
    assert.equal(conta.get(504, "credit").n, 0);
    assert.equal(raw.prepare("SELECT status FROM deliveries WHERE id = 504").get().status, "delivered");
});

test("corrida já entregue não ganha lançamento novo", () => {
    const r = fecharCorridaNoBanco(base(505, { fee: 30 }));
    assert.equal(r.ok, true);
    assert.equal(r.jaEntregue, true);
    assert.equal(conta.get(505, "credit").n, 0);
});

test("corrida que não existe devolve erro, não estoura", () => {
    const r = fecharCorridaNoBanco(base(9999));
    assert.equal(r.ok, false);
    assert.match(r.erro, /não encontrada/i);
});

// ── corrida "a conferir": o Pix é DA LOJA ──────────────────────────────────
// É o caso novo e o que mais pode dar errado no acerto: o cliente paga no Pix
// da loja e o motoboy só confere. Esse dinheiro nunca passou pela mão dele,
// então NÃO pode virar débito — senão o motoboy fecha o dia devendo à loja um
// valor que ele nunca recebeu.

test('"Pix confirmado" numa corrida a conferir credita a taxa e NÃO debita nada', () => {
    const r = fecharCorridaNoBanco(base(506, {
        fee: 7,
        recibo: {
            receiptStatus: "recebido", receivedAmount: 120,
            receivedMethod: "pix", receiptNote: null,
        },
    }));

    assert.equal(r.ok, true);
    assert.equal(r.creditoLancado, true);
    assert.equal(r.debitoLancado, false, "PIX da loja não fica na mão do motoboy");
    assert.equal(conta.get(506, "debit").n, 0, "nenhum débito lançado");
    assert.equal(conta.get(506, "credit").total, 7);
});

test('"pagou em dinheiro pra mim" numa corrida a conferir DEBITA, igual a uma "a receber"', () => {
    const r = fecharCorridaNoBanco(base(507, {
        fee: 7,
        recibo: {
            receiptStatus: "recebido", receivedAmount: 120,
            receivedMethod: "dinheiro", receiptNote: null,
        },
    }));

    assert.equal(r.ok, true);
    assert.equal(r.debitoLancado, true);
    assert.equal(conta.get(507, "debit").total, 120);
});

test("no resumo do dia o Pix conferido entra em PIX, nunca em dinheiro", async () => {
    // As duas corridas acima são do mesmo dia: o resumo tem que separar
    // R$ 120 de Pix (da loja) de R$ 120 em espécie (na mão do motoboy).
    const dia = raw.prepare(
        "SELECT date(datetime(delivered_at, '-3 hours')) AS d FROM deliveries WHERE id = 506"
    ).get().d;

    const { getDailySummary } = await import("@/lib/dailySummary");
    const resumo = await getDailySummary(MOTOBOY, LOJA, dia);

    const pixDaCorrida = resumo.lines.find((l) => l.id === 506);
    assert.equal(pixDaCorrida.receivedMethod, "pix");
    assert.ok(resumo.pixTotal >= 120, `pixTotal deveria contar os R$ 120 do Pix (veio ${resumo.pixTotal})`);
    assert.ok(resumo.cashTotal >= 120, `cashTotal conta só o dinheiro em espécie (veio ${resumo.cashTotal})`);

    // O líquido é taxa − dinheiro em ESPÉCIE: o Pix não entra na conta.
    assert.equal(
        Math.round((resumo.feesTotal - resumo.cashTotal) * 100) / 100,
        resumo.net,
        "o Pix não pode aparecer no líquido"
    );
});

// ── a LOJA finaliza uma corrida que ninguém aceitou ────────────────────────

test("loja finaliza corrida órfã escolhendo o motoboy: a corrida vira dele e a carteira acompanha", () => {
    const r = fecharCorridaNoBanco(base(508, {
        motoboyId: null,          // a corrida não tinha dono
        atribuirMotoboyId: MOTOBOY, // ...até a loja dizer quem entregou
        fee: 9,
        recibo: {
            receiptStatus: "recebido", receivedAmount: 40,
            receivedMethod: "dinheiro", receiptNote: "finalizada pela loja (Loja Dev)",
        },
    }));

    assert.equal(r.ok, true);
    assert.equal(r.jaEntregue, false);
    assert.equal(r.creditoLancado, true);
    assert.equal(r.debitoLancado, true);

    const linha = raw.prepare("SELECT status, motoboy_id, receipt_note FROM deliveries WHERE id = 508").get();
    assert.equal(linha.status, "delivered");
    assert.equal(linha.motoboy_id, MOTOBOY, "sem dono a corrida sumiria do resumo do dia");
    assert.match(linha.receipt_note, /finalizada pela loja/);

    const credito = raw.prepare(
        "SELECT user_id, amount FROM transactions WHERE related_delivery_id = 508 AND type = 'credit'"
    ).get();
    assert.equal(credito.user_id, MOTOBOY);
    assert.equal(credito.amount, 9);
    assert.equal(conta.get(508, "debit").total, 40);
});

test("lançamento manual (sem corrida) continua podendo repetir", () => {
    const manual = raw.prepare(`
        INSERT INTO transactions (user_id, amount, type, kind, status, description, related_delivery_id, created_at)
        VALUES (?, 50, 'credit', 'ajuste', 'confirmed', 'Bônus', NULL, '2026-09-06T13:00:00.000Z')
    `);
    manual.run(MOTOBOY);
    manual.run(MOTOBOY);
    const n = raw.prepare(
        "SELECT COUNT(*) AS n FROM transactions WHERE related_delivery_id IS NULL AND kind = 'ajuste'"
    ).get().n;
    assert.equal(n, 2, "o índice é parcial: só vale pra lançamento de corrida");
});
