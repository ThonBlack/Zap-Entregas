/**
 * "Quem vê minhas corridas" (shop_settings.pool_mode) e a corrida destinada
 * pela loja a um motoboy específico.
 *
 * O que está sendo protegido: antes o pool era sempre aberto — qualquer motoboy
 * cadastrado no app via, e podia aceitar, corrida de qualquer loja. Agora o
 * PADRÃO é fechado ("equipe"), e três lugares precisam concordar com a MESMA
 * régua (src/lib/team.ts): a lista de pendentes, o aceitar e o push. Se eles
 * divergirem, o motoboy recebe notificação de corrida que a tela não mostra —
 * ou pior, consegue aceitar uma que não devia nem ver.
 *
 * Rodar:
 *   node --import ./scripts/test/ts-loader.mjs --test scripts/test/pool.test.mjs
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
const BANCO = path.join(os.tmpdir(), `zap-pool-${process.pid}.db`);

const ADMIN = 1;
const LOJA_A = 2;   // fecha o pool (padrão)
const MOTO_A = 3;   // motoboy da loja A
const MOTO_B = 4;   // motoboy da loja B
const LOJA_B = 20;  // abre o pool
const MOTO_SEM_LOJA = 30;

fs.copyFileSync(path.join(RAIZ, "sqlite.db"), BANCO);
process.env.DATABASE_PATH = BANCO;

// Migrações leves na cópia (as mesmas que rodam no start do container).
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

// Loja B e um motoboy "da casa" (sem loja) não existem no banco de dev.
raw.prepare(
    "INSERT OR REPLACE INTO users (id, name, phone, role, shopkeeper_id) VALUES (?, ?, ?, ?, ?)"
).run(LOJA_B, "Loja B", "34900000020", "shopkeeper", null);
raw.prepare(
    "INSERT OR REPLACE INTO users (id, name, phone, role, shopkeeper_id) VALUES (?, ?, ?, ?, ?)"
).run(MOTO_SEM_LOJA, "Motoboy da casa", "34900000030", "motoboy", null);

// Vínculo dos motoboys com as lojas.
raw.prepare("UPDATE users SET shopkeeper_id = ? WHERE id = ?").run(LOJA_A, MOTO_A);
raw.prepare("UPDATE users SET shopkeeper_id = ? WHERE id = ?").run(LOJA_B, MOTO_B);

// Loja A no padrão ('equipe'); loja B com o pool aberto.
const cfg = raw.prepare(
    "INSERT OR REPLACE INTO shop_settings (user_id, pool_mode) VALUES (?, ?)"
);
cfg.run(LOJA_A, "equipe");
cfg.run(LOJA_B, "aberta");

const novaCorrida = raw.prepare(`
    INSERT INTO deliveries (id, shopkeeper_id, motoboy_id, status, address, value, created_at, updated_at)
    VALUES (@id, @loja, @motoboy, @status, @endereco, 0, @agora, @agora)
`);
function corrida(o) {
    novaCorrida.run({
        motoboy: null, status: "pending", endereco: "Rua Teste, 100 - Centro",
        agora: "2026-09-14T12:00:00.000Z", ...o,
    });
}

corrida({ id: 701, loja: LOJA_A });                    // loja fechada, na fila
corrida({ id: 702, loja: LOJA_B });                    // loja aberta, na fila
corrida({ id: 703, loja: LOJA_A, motoboy: MOTO_B, status: "assigned" }); // destinada a um de fora

const MOTOBOYS = {
    A: { id: MOTO_A, role: "motoboy", shopkeeperId: LOJA_A },
    B: { id: MOTO_B, role: "motoboy", shopkeeperId: LOJA_B },
    SEM_LOJA: { id: MOTO_SEM_LOJA, role: "motoboy", shopkeeperId: null },
    ADMIN: { id: ADMIN, role: "admin", shopkeeperId: null },
};

const { corridaVisivelParaMotoboy, motoboyEnxergaCorrida, publicoDoAvisoDeCorridaNova, poolModeDaLoja } =
    await import("@/lib/team");
const { db } = await import("@/db");
const { deliveries } = await import("@/db/schema");

/** Ids que ESTE motoboy enxerga, pela mesma condição SQL que a tela /app usa. */
async function idsVisiveis(motoboy) {
    const linhas = await db
        .select({ id: deliveries.id })
        .from(deliveries)
        .where(corridaVisivelParaMotoboy(motoboy));
    return linhas.map((l) => l.id).sort((a, b) => a - b);
}

test.after(() => {
    try { raw.close(); } catch { /* já fechado */ }
    try { fs.unlinkSync(BANCO); } catch { /* o Windows às vezes segura o arquivo */ }
});

// --- o padrão ---------------------------------------------------------------

test("loja sem configuração salva nasce fechada ('equipe')", async () => {
    assert.equal(await poolModeDaLoja(999999), "equipe");
});

test("a coluna guarda o que a loja escolheu", async () => {
    assert.equal(await poolModeDaLoja(LOJA_A), "equipe");
    assert.equal(await poolModeDaLoja(LOJA_B), "aberta");
});

// --- quem vê o quê ----------------------------------------------------------

test("no modo 'equipe' o motoboy de outra loja NÃO vê a corrida na fila", async () => {
    const visiveis = await idsVisiveis(MOTOBOYS.B);
    assert.ok(!visiveis.includes(701), "701 é da loja A, que está fechada");
});

test("no modo 'aberta' qualquer motoboy vê a corrida na fila", async () => {
    const visiveis = await idsVisiveis(MOTOBOYS.A);
    assert.ok(visiveis.includes(702), "702 é da loja B, que está aberta");
});

test("o motoboy da própria loja vê a corrida dela mesmo fechada", async () => {
    const visiveis = await idsVisiveis(MOTOBOYS.A);
    assert.ok(visiveis.includes(701));
});

test("motoboy sem loja fica de fora do modo 'equipe', mas pega a fila aberta", async () => {
    const visiveis = await idsVisiveis(MOTOBOYS.SEM_LOJA);
    assert.ok(!visiveis.includes(701), "não é de ninguém: não entra na equipe de ninguém");
    assert.ok(visiveis.includes(702));
});

test("corrida DESTINADA pela loja chega mesmo num motoboy de fora", async () => {
    // A loja A escolheu a dedo um motoboy da loja B: o pool fechado não pode
    // esconder dele a corrida que ele foi incumbido de fazer.
    const visiveis = await idsVisiveis(MOTOBOYS.B);
    assert.ok(visiveis.includes(703));
});

test("admin continua enxergando a operação inteira", async () => {
    assert.equal(corridaVisivelParaMotoboy(MOTOBOYS.ADMIN), undefined, "sem filtro nenhum");
    assert.equal(await motoboyEnxergaCorrida(MOTOBOYS.ADMIN, { motoboyId: null, shopkeeperId: LOJA_A }), true);
});

// --- aceitar usa a MESMA régua ---------------------------------------------

test("a régua do aceitar bate com a da tela", async () => {
    const daLojaFechada = { motoboyId: null, shopkeeperId: LOJA_A };
    const daLojaAberta = { motoboyId: null, shopkeeperId: LOJA_B };

    assert.equal(await motoboyEnxergaCorrida(MOTOBOYS.B, daLojaFechada), false, "não pode aceitar o que não vê");
    assert.equal(await motoboyEnxergaCorrida(MOTOBOYS.A, daLojaFechada), true);
    assert.equal(await motoboyEnxergaCorrida(MOTOBOYS.B, daLojaAberta), true);
    assert.equal(await motoboyEnxergaCorrida(MOTOBOYS.SEM_LOJA, daLojaFechada), false);

    // Destinada a ele: vale em qualquer modo.
    assert.equal(
        await motoboyEnxergaCorrida(MOTOBOYS.B, { motoboyId: MOTO_B, shopkeeperId: LOJA_A }),
        true
    );
});

// --- o push segue a mesma régua --------------------------------------------

test("corrida nova de loja fechada só avisa a equipe dela (e os admins)", async () => {
    const publico = await publicoDoAvisoDeCorridaNova(LOJA_A);
    assert.ok(publico.includes(MOTO_A), "o motoboy da loja tem que ser avisado");
    assert.ok(publico.includes(ADMIN), "admin acompanha a operação");
    assert.ok(!publico.includes(MOTO_B), "motoboy de outra loja não é avisado do que não vê");
    assert.ok(!publico.includes(MOTO_SEM_LOJA), "motoboy sem loja também não");
});

test("corrida nova de loja aberta avisa todo mundo, como era antes", async () => {
    const publico = await publicoDoAvisoDeCorridaNova(LOJA_B);
    for (const id of [MOTO_A, MOTO_B, MOTO_SEM_LOJA, ADMIN]) {
        assert.ok(publico.includes(id), `esperava ${id} no público do aviso`);
    }
});

test("motoboy desativado não é avisado", async () => {
    raw.prepare("UPDATE users SET is_active = 0 WHERE id = ?").run(MOTO_A);
    try {
        const publico = await publicoDoAvisoDeCorridaNova(LOJA_A);
        assert.ok(!publico.includes(MOTO_A));
    } finally {
        raw.prepare("UPDATE users SET is_active = 1 WHERE id = ?").run(MOTO_A);
    }
});
