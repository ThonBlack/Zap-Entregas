/**
 * Trocar o motoboy de uma corrida (src/lib/trocaDeMotoboy.ts) — pela Fila da
 * loja, pela loja no app e pelo admin.
 *
 * O que está sendo protegido:
 *   (a) a fila só escolhe motoboy da equipe DA LOJA DA SESSÃO — nunca de outra
 *       loja, nem um "da casa", nem um desativado;
 *   (b) a fila só troca até a coleta; o admin troca até a entrega, e a corrida
 *       coletada continua coletada no nome do novo motoboy;
 *   (c) o admin só passa a corrida pra quem serve à loja dela;
 *   (d) leitura velha (alguém mexeu no meio) não grava nada;
 *   (e) trocar não mexe em dinheiro: o crédito só nasce na entrega, pro dono
 *       da corrida naquele momento;
 *   (f) fica rastro em app_logs de quem trocou.
 *
 * Push: sem VAPID no ambiente de teste, todo aviso é no-op — nada sai daqui.
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/trocaDeMotoboy.test.mjs
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
const BANCO = path.join(os.tmpdir(), `zap-troca-${process.pid}.db`);

delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;

// --- monta o banco de teste ANTES de importar o código (o @/db lê a env no load)
fs.copyFileSync(path.join(RAIZ, "sqlite.db"), BANCO);
process.env.DATABASE_PATH = BANCO;
for (const m of fs.readdirSync(UTILS).filter((f) => /^add_.*\.js$/.test(f) || f === "make_phone_nullable.js").sort()) {
    execFileSync(process.execPath, [path.join(UTILS, m)], {
        env: { ...process.env, DATABASE_PATH: BANCO },
        stdio: "ignore",
    });
}

const raw = new Database(BANCO);
raw.pragma("foreign_keys = OFF");
raw.exec(`DELETE FROM shop_queue_sessions; DELETE FROM daily_closings; DELETE FROM transactions;
          DELETE FROM deliveries; DELETE FROM app_logs; DELETE FROM push_subscriptions;`);

const LOJA_A = 7001;
const LOJA_B = 7002;
const ADMIN = 7000;
const JOAO = 7011; // loja A
const MARIA = 7012; // loja A
const PEDRO = 7021; // loja B
const CASA = 7031; // "da casa" (sem loja)
const INATIVO = 7013; // loja A, desativado

const inserirUsuario = raw.prepare(`
    INSERT OR REPLACE INTO users (id, name, phone, role, shopkeeper_id, is_active, plan, subscription_status)
    VALUES (?, ?, ?, ?, ?, ?, 'free', 'active')
`);
for (const [id, nome, papel, loja, ativo] of [
    [ADMIN, "Admin", "admin", null, 1],
    [LOJA_A, "Loja A", "shopkeeper", null, 1],
    [LOJA_B, "Loja B", "shopkeeper", null, 1],
    [JOAO, "João", "motoboy", LOJA_A, 1],
    [MARIA, "Maria", "motoboy", LOJA_A, 1],
    [PEDRO, "Pedro", "motoboy", LOJA_B, 1],
    [CASA, "Casa", "motoboy", null, 1],
    [INATIVO, "Inativo", "motoboy", LOJA_A, 0],
]) {
    inserirUsuario.run(id, nome, `+55349900${id}`, papel, loja, ativo);
}

const inserirCorrida = raw.prepare(`
    INSERT INTO deliveries (id, shopkeeper_id, motoboy_id, status, address, customer_name, lat, lng,
                            value, charge_mode, fee, daily_seq, picked_up_at, accepted_at, created_at, updated_at)
    VALUES (@id, @loja, @motoboy, @status, @endereco, 'Fulano', -19.75, -47.93,
            0, 'pago', 7, @numero, @coletadaEm, @aceitaEm, @criadaEm, @criadaEm)
`);
function corrida(o) {
    inserirCorrida.run({
        loja: LOJA_A, motoboy: null, status: "pending", endereco: "Rua Teste, 100 - Centro",
        numero: 3, coletadaEm: null, aceitaEm: null, criadaEm: new Date().toISOString(), ...o,
    });
}
const ler = (id) => raw.prepare("SELECT * FROM deliveries WHERE id = ?").get(id);

const { criarSessaoDaFila } = await import("@/lib/queueSession");
const { trocarMotoboyDaCorrida } = await import("@/lib/trocaDeMotoboy");
const { conferirRascunhoDaFilaAction } = await import("@/app/actions/queue");
const { trocarMotoboyDaFilaAction } = await import("@/app/actions/filaMotoboy");
const { fecharCorridaNoBanco } = await import("@/lib/deliveryLedger");

test.after(() => {
    try { raw.close(); } catch { /* já fechado */ }
    try { fs.unlinkSync(BANCO); } catch { /* o Windows às vezes segura o arquivo */ }
});

async function fila(loja = LOJA_A, operador = "Maria do Caixa") {
    const { token } = await criarSessaoDaFila(loja, operador);
    return token;
}
function form(campos) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.set(k, String(v));
    return fd;
}
const ADMIN_ATOR = { papel: "admin", id: ADMIN, nome: "Admin" };

// =========================================================================
// (a) Fila: liberar o rascunho escolhendo quem leva
// =========================================================================

test("fila libera o rascunho já no nome de um motoboy da loja", async () => {
    corrida({ id: 9100, status: "draft", numero: null });
    const res = await conferirRascunhoDaFilaAction(form({
        queueToken: await fila(), id: 9100, address: "Rua Teste, 100 - Centro",
        chargeMode: "pago", pinTouched: "0", lat: "0", lng: "0", motoboyId: JOAO,
    }));
    assert.deepEqual(res, { success: true });
    const c = ler(9100);
    assert.equal(c.status, "assigned", "destinada nasce aceita");
    assert.equal(c.motoboy_id, JOAO);
    assert.ok(c.accepted_at);
    assert.match(c.observation, /destinada pela loja \(Maria do Caixa\) a João/);
    assert.equal(c.fee, 7, "a taxa vem do banco, nunca da tela");
});

test("fila sem escolher ninguém libera pra fila aberta, como sempre", async () => {
    corrida({ id: 9101, status: "draft", numero: null });
    const res = await conferirRascunhoDaFilaAction(form({
        queueToken: await fila(), id: 9101, address: "Rua Teste, 100 - Centro",
        chargeMode: "pago", pinTouched: "0", lat: "0", lng: "0", motoboyId: "",
    }));
    assert.deepEqual(res, { success: true });
    const c = ler(9101);
    assert.equal(c.status, "pending");
    assert.equal(c.motoboy_id, null);
});

test("fila NÃO libera no nome de motoboy de outra loja, nem 'da casa', nem desativado", async () => {
    for (const [id, motoboy] of [[9102, PEDRO], [9103, CASA], [9104, INATIVO], [9105, 999999]]) {
        corrida({ id, status: "draft", numero: null });
        const res = await conferirRascunhoDaFilaAction(form({
            queueToken: await fila(), id, address: "Rua Teste, 100 - Centro",
            chargeMode: "pago", pinTouched: "0", lat: "0", lng: "0", motoboyId: motoboy,
        }));
        assert.ok("error" in res, `motoboy ${motoboy} devia ser recusado`);
        assert.equal(ler(id).status, "draft", "a corrida não pode ter saído do rascunho");
    }
});

// =========================================================================
// (a/b) Fila: trocar até a coleta
// =========================================================================

test("fila troca o motoboy de uma corrida aceita, dentro da equipe", async () => {
    corrida({ id: 9110, status: "assigned", motoboy: JOAO, aceitaEm: "2026-10-02T12:00:00.000Z" });
    const res = await trocarMotoboyDaFilaAction(form({ queueToken: await fila(), id: 9110, motoboyId: MARIA }));
    assert.deepEqual(res, { success: true });
    const c = ler(9110);
    assert.equal(c.motoboy_id, MARIA);
    assert.equal(c.status, "assigned");

    const log = raw.prepare("SELECT * FROM app_logs WHERE event = 'motoboy_trocado' ORDER BY id DESC").get();
    assert.ok(log, "faltou o rastro da troca");
    const meta = JSON.parse(log.metadata);
    assert.equal(meta.deliveryId, 9110);
    assert.equal(meta.de, JOAO);
    assert.equal(meta.para, MARIA);
    assert.equal(meta.por, "fila");
    assert.equal(meta.operatorName, "Maria do Caixa");
    assert.ok(log.created_at, "o 'quando' da troca");
});

test("fila devolve pra fila aberta: sem dono, 'pending', sem carimbo de aceite", async () => {
    corrida({ id: 9111, status: "assigned", motoboy: JOAO, aceitaEm: "2026-10-02T12:00:00.000Z" });
    const res = await trocarMotoboyDaFilaAction(form({ queueToken: await fila(), id: 9111, motoboyId: "" }));
    assert.deepEqual(res, { success: true });
    const c = ler(9111);
    assert.equal(c.motoboy_id, null);
    assert.equal(c.status, "pending");
    assert.equal(c.accepted_at, null);
});

test("fila não troca depois da coleta", async () => {
    corrida({ id: 9112, status: "picked_up", motoboy: JOAO, coletadaEm: "2026-10-02T12:10:00.000Z" });
    const res = await trocarMotoboyDaFilaAction(form({ queueToken: await fila(), id: 9112, motoboyId: MARIA }));
    assert.ok("error" in res);
    assert.equal(ler(9112).motoboy_id, JOAO);
});

test("fila não troca pra motoboy de outra loja nem pra 'da casa'", async () => {
    corrida({ id: 9113, status: "assigned", motoboy: JOAO });
    for (const outro of [PEDRO, CASA, INATIVO]) {
        const res = await trocarMotoboyDaFilaAction(form({ queueToken: await fila(), id: 9113, motoboyId: outro }));
        assert.ok("error" in res, `motoboy ${outro} devia ser recusado`);
    }
    assert.equal(ler(9113).motoboy_id, JOAO);
});

test("código da loja A não troca o motoboy da corrida da loja B", async () => {
    corrida({ id: 9114, loja: LOJA_B, status: "assigned", motoboy: PEDRO });
    const res = await trocarMotoboyDaFilaAction(form({ queueToken: await fila(LOJA_A), id: 9114, motoboyId: "" }));
    assert.ok("error" in res);
    assert.equal(ler(9114).motoboy_id, PEDRO);
});

test("código vencido não troca nada", async () => {
    corrida({ id: 9115, status: "assigned", motoboy: JOAO });
    const { newQueueToken } = await import("@/lib/trackingToken");
    const vencido = newQueueToken();
    raw.prepare(`INSERT INTO shop_queue_sessions (token, shopkeeper_id, operator_name, expires_at, created_at)
                 VALUES (?, ?, NULL, ?, ?)`).run(vencido, LOJA_A, new Date(Date.now() - 1000).toISOString(), new Date().toISOString());
    const res = await trocarMotoboyDaFilaAction(form({ queueToken: vencido, id: 9115, motoboyId: MARIA }));
    assert.ok("error" in res);
    assert.equal(ler(9115).motoboy_id, JOAO);
});

// =========================================================================
// (b/c) Admin
// =========================================================================

test("admin passa a corrida COLETADA pra outro: continua coletada, com a hora da coleta", async () => {
    corrida({ id: 9120, status: "picked_up", motoboy: JOAO, coletadaEm: "2026-10-02T12:10:00.000Z" });
    const res = await trocarMotoboyDaCorrida(toCorrida(9120), MARIA, ADMIN_ATOR);
    assert.deepEqual(res, { ok: true, jaEra: false });
    const c = ler(9120);
    assert.equal(c.motoboy_id, MARIA);
    assert.equal(c.status, "picked_up", "o pedido já saiu da loja — não volta pra 'Peguei o pedido'");
    assert.equal(c.picked_up_at, "2026-10-02T12:10:00.000Z");
    assert.match(c.observation, /destinada pelo admin a Maria/);
});

test("admin devolve pra fila uma corrida coletada: zera dono, aceite e coleta", async () => {
    corrida({ id: 9121, status: "picked_up", motoboy: JOAO, coletadaEm: "2026-10-02T12:10:00.000Z", aceitaEm: "x" });
    const res = await trocarMotoboyDaCorrida(toCorrida(9121), null, ADMIN_ATOR);
    assert.equal(res.ok, true);
    const c = ler(9121);
    assert.equal(c.status, "pending");
    assert.equal(c.motoboy_id, null);
    assert.equal(c.accepted_at, null);
    assert.equal(c.picked_up_at, null);
});

test("admin só passa pra quem serve à loja da corrida (inclui os 'da casa')", async () => {
    corrida({ id: 9122, status: "assigned", motoboy: JOAO });
    const errado = await trocarMotoboyDaCorrida(toCorrida(9122), PEDRO, ADMIN_ATOR);
    assert.equal(errado.ok, false, "motoboy da loja B não pega corrida da loja A");
    assert.equal(ler(9122).motoboy_id, JOAO);

    const daCasa = await trocarMotoboyDaCorrida(toCorrida(9122), CASA, ADMIN_ATOR);
    assert.equal(daCasa.ok, true);
    assert.equal(ler(9122).motoboy_id, CASA);
});

test("entregue e cancelada não trocam nem pelo admin", async () => {
    corrida({ id: 9123, status: "delivered", motoboy: JOAO });
    corrida({ id: 9124, status: "canceled", motoboy: JOAO });
    for (const id of [9123, 9124]) {
        const res = await trocarMotoboyDaCorrida(toCorrida(id), MARIA, ADMIN_ATOR);
        assert.equal(res.ok, false);
        assert.equal(ler(id).motoboy_id, JOAO);
    }
});

test("lojista no app continua sem trocar a coletada", async () => {
    corrida({ id: 9125, status: "picked_up", motoboy: JOAO, coletadaEm: "2026-10-02T12:10:00.000Z" });
    const res = await trocarMotoboyDaCorrida(toCorrida(9125), MARIA, { papel: "loja", id: LOJA_A, nome: "Loja A" });
    assert.equal(res.ok, false);
    assert.equal(ler(9125).motoboy_id, JOAO);
});

// =========================================================================
// (d) leitura velha
// =========================================================================

test("se o motoboy aceitou/coletou entre a leitura e a gravação, nada é gravado", async () => {
    corrida({ id: 9130, status: "assigned", motoboy: JOAO });
    const lida = toCorrida(9130);
    raw.prepare("UPDATE deliveries SET status = 'picked_up', picked_up_at = ? WHERE id = 9130").run(new Date().toISOString());
    // A loja tenta trocar com a leitura antiga ("assigned").
    const res = await trocarMotoboyDaCorrida(lida, MARIA, { papel: "loja", id: LOJA_A, nome: "Loja A" });
    assert.equal(res.ok, false);
    assert.match(res.erro, /mudou de situação/);
    assert.equal(ler(9130).motoboy_id, JOAO);
});

// =========================================================================
// (e) dinheiro
// =========================================================================

test("trocar não lança nada; o crédito nasce na entrega, pro dono daquele momento", async () => {
    corrida({ id: 9140, status: "picked_up", motoboy: JOAO, coletadaEm: "2026-10-02T12:10:00.000Z" });
    await trocarMotoboyDaCorrida(toCorrida(9140), MARIA, ADMIN_ATOR);
    const antes = raw.prepare("SELECT COUNT(*) n FROM transactions WHERE related_delivery_id = 9140").get().n;
    assert.equal(antes, 0, "troca não pode gerar lançamento");

    const fechado = fecharCorridaNoBanco({
        deliveryId: 9140, motoboyId: MARIA, shopkeeperId: LOJA_A, customerName: "Fulano", fee: 7,
        recibo: { receiptStatus: "nada_a_receber", receivedAmount: null, receivedMethod: null, receiptNote: null },
        statusAbertos: ["assigned", "picked_up"],
    });
    assert.equal(fechado.ok, true);
    const creditos = raw.prepare("SELECT user_id FROM transactions WHERE related_delivery_id = 9140 AND type = 'credit'").all();
    assert.deepEqual(creditos.map((c) => c.user_id), [MARIA], "a taxa é de quem entregou, não de quem começou");
});

/** A corrida como o servidor a carrega (camelCase), lida agora do banco. */
function toCorrida(id) {
    const c = ler(id);
    return {
        id: c.id, status: c.status, motoboyId: c.motoboy_id, shopkeeperId: c.shopkeeper_id,
        observation: c.observation, pickedUpAt: c.picked_up_at, address: c.address, dailySeq: c.daily_seq,
    };
}
